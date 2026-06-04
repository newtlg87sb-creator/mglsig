import sys
import ccxt
import threading
import time
from PyQt6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, 
                             QHBoxLayout, QTableWidget, QTableWidgetItem, 
                             QPushButton, QHeaderView, QWidget, QTextEdit, QLabel, QMessageBox)
from PyQt6.QtCore import pyqtSignal, QObject, Qt
from PyQt6.QtGui import QFont
from datetime import datetime

from Trade import QComboBox

class NumericTableWidgetItem(QTableWidgetItem):
    def __lt__(self, other):
        try:
            v1 = self.data(Qt.ItemDataRole.EditRole)
            v2 = other.data(Qt.ItemDataRole.EditRole)
            if v1 is None: return True
            if v2 is None: return False
            if isinstance(v1, (int, float)) and isinstance(v2, (int, float)):
                return v1 < v2
            return float(v1) < float(v2)
        except:
            return super().__lt__(other)

class ExchangeWorker(QObject):
    data_updated = pyqtSignal(list)
    log_signal = pyqtSignal(str)
    timer_signal = pyqtSignal(str)
    
    def __init__(self, exchange_id, market_type='spot'):
        super().__init__()
        self.exchange_id = exchange_id
        self.market_type = market_type # 'spot' or 'swap'
        self.running = False
        self.exchange = None

    def run(self):
        ex_name = self.exchange_id.upper()
        m_type_name = "FUTURE" if self.market_type == 'swap' else "SPOT"
        def log(msg): self.log_signal.emit(f"[{datetime.now().strftime('%H:%M:%S')}] ({ex_name} {m_type_name}) {msg}")
        update_interval = 5
        
        try:
            options = {'enableRateLimit': True, 'options': {'defaultType': self.market_type}}
            self.exchange = getattr(ccxt, self.exchange_id)(options)
            
            log(f"{ex_name}-аас мэдээлэл татаж байна...")
            markets = self.exchange.load_markets()
            
            # Төрлөөс хамаарч шүүлтүүр хийх (Swap бол Perpetual Futures)
            symbols = [s for s, m in markets.items() 
                      if m['active'] and m.get('type') == self.market_type and m.get('quote') == 'USDT']
            
            log(f"Нийт {len(symbols)} USDT {m_type_name} хос олдлоо.")

            while self.running:
                start_time = time.time()
                self.timer_signal.emit("LIVE")
                try: tickers = self.exchange.fetch_tickers(symbols)
                except: tickers = self.exchange.fetch_tickers()
                
                if not tickers or not isinstance(tickers, dict):
                    time.sleep(1)
                    continue

                display_data = []
                for symbol in symbols:
                    m_data = markets[symbol]
                    market_id = m_data.get('id')
                    # Бирж бүрийн тикерийн түлхүүр өөр байж болох тул Symbol болон ID-аар давхар шалгана
                    t = tickers.get(symbol) or tickers.get(market_id)
                    
                    if t:
                        
                        # --- Coin Full Name Extraction ---
                        base_currency_code = symbol.split('/')[0]
                        full_coin_name = base_currency_code # Default fallback
                        info = m_data.get('info', {})

                        # 1. CCXT currencies dictionary-аас хайх
                        if self.exchange.currencies and base_currency_code in self.exchange.currencies:
                            currency_info = self.exchange.currencies[base_currency_code]
                            full_coin_name = currency_info.get('name') or full_coin_name
                        
                        # 2. Түүхий 'info' доторх бүх мэдэгдэж буй нэрний талбаруудыг шалгах
                        if full_coin_name == base_currency_code:
                            # Бирж болгоны өөр өөрөөр нэрлэдэг талбаруудын жагсаалт
                            name_keys = [
                                'fullName', 'baseCurrencyFullName', 'displayName', 'assetName', 
                                'baseAsset', 'base_asset_name', 'base_currency_name', 'coinName', 'name'
                            ]
                            for k in name_keys:
                                val = info.get(k)
                                if val and isinstance(val, str) and val.upper() != base_currency_code.upper():
                                    full_coin_name = val
                                    break
                        
                        # Clean up and format the name
                        full_coin_name = full_coin_name.replace('/USDT', '').strip()
                        # Capitalize each word if it looks like a proper name, otherwise keep as is (e.g., "0G" should stay "0G")
                        if ' ' in full_coin_name or (len(full_coin_name) > 1 and full_coin_name[0].isalpha() and full_coin_name[1:].islower()):
                            full_coin_name = ' '.join([word.capitalize() for word in full_coin_name.split(' ')])
                        # --- End Coin Full Name Extraction ---
                        
                        m_info = markets[symbol].get('info', {})
                        found_tags = set()
                        risk_keywords = {'ST', 'MONITORING', 'SEED', 'DELIST', 'WARNING', 'RISK', 'SPECIAL'}
                        
                        #Recursive Scanner: Түүхий дата доторх бүх утгыг шалгах
                        def scan_risk(obj):
                            if isinstance(obj, str):
                                val_up = obj.upper()
                                for kw in risk_keywords:
                                    if kw in val_up: found_tags.add(kw)
                            elif isinstance(obj, list):
                                for item in obj: scan_risk(item)
                            elif isinstance(obj, dict):
                                for v in obj.values(): scan_risk(v)
                        
                        scan_risk(m_info)
                        
                        # Boolean флагуудыг тусад нь шалгах (Бирж бүрийн онцлог)
                        if any([m_info.get('isST'), m_info.get('is_st') == '1', m_info.get('st') == 1]):
                            found_tags.add('ST')
                        
                        tag_str = "/".join(sorted(found_tags))
                        
                        # Үнийн мэдээлэл байхгүй бол Last-аар орлуулна (LBank, BitMart зэрэгт хэрэгтэй)
                        last_p = t.get('last')
                        bid_p = t.get('bid') or last_p
                        ask_p = t.get('ask') or last_p
                        pct = t.get('percentage')

                        # Min Trade (USDT) тооцоолох
                        market_info = markets.get(symbol, {})
                        min_qty = market_info.get('limits', {}).get('amount', {}).get('min')
                        min_usdt = min_qty * ask_p if min_qty is not None and ask_p is not None else None
                        
                        # Spread тооцоолох (%)
                        spread_p = ((ask_p - bid_p) / bid_p * 100) if bid_p and ask_p and bid_p > 0 else 0

                        display_data.append([full_coin_name, symbol, last_p, bid_p, ask_p, pct, min_usdt, tag_str, spread_p])
                
                self.data_updated.emit(display_data)
                
                elapsed = time.time() - start_time
                sleep_time = max(0, update_interval - elapsed)
                
                for i in range(int(sleep_time * 10)):
                    if not self.running: break
                    rem = sleep_time - (i * 0.1)
                    self.timer_signal.emit(f"{rem:.1f}s")
                    time.sleep(0.1)
            
            # ccxt синхрон хувилбарт close() функц байдаггүй тул устгав
            # self.exchange.close() 
        except Exception as e:
            log(f"⚠️ Алдаа: {str(e)}")
            self.running = False

class BinanceSpotApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("MGL Unified Scanner (Spot & Future)")
        self.resize(1100, 750)
        self.currencies_data = {} # Сүлжээний мэдээлэл хадгалах
        
        # Биржүүдийн жагсаалт - Энд нэмэхэд л UI-д автоматаар гарна
        self.exchange_list = {
            'binance': '#28a745', 'kucoin': '#009292', 'mexc': '#00b2ff', 
            'bybit': '#f39c12', 'okx': '#34E0FF', 'gateio': '#f84949',
            'bitget': '#00D1FF', 'htx': '#00A6FF', 'bitmart': '#00cc99', 
            'phemex': '#2980b9'
        }
        self.workers = {}
        self.buttons = {}

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_h_layout = QHBoxLayout(central_widget)

        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.addWidget(QLabel("LOGS / ERRORS"))
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setStyleSheet("background-color: #000; color: #00ff00; font-family: 'Consolas'; font-size: 11px;")
        left_layout.addWidget(self.log_box)
        main_h_layout.addWidget(left_panel, 1)

        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        # Market Type Selector
        type_layout = QHBoxLayout()
        type_layout.addWidget(QLabel("<b>SELECT MARKET TYPE:</b>"))
        self.type_combo = QComboBox()
        self.type_combo.addItems(["SPOT", "FUTURE (PERP)"])
        self.type_combo.setStyleSheet("background-color: #333; color: white; padding: 5px; font-weight: bold;")
        self.type_combo.currentIndexChanged.connect(self.on_type_changed)
        type_layout.addWidget(self.type_combo)
        type_layout.addStretch()
        right_layout.addLayout(type_layout)

        self.table = QTableWidget()
        self.table.setColumnCount(9) # Нэр нэмэгдсэн тул 9 багана
        self.update_table_headers()
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSortingEnabled(True)
        self.table.verticalHeader().setFixedWidth(45)
        self.table.cellClicked.connect(self.show_networks)

        self.timer_label = QLabel("OFF", self.table)
        self.timer_label.setGeometry(0, 0, 45, 32)
        self.timer_label.setStyleSheet("color: #00ff00; background-color: #333; font-weight: bold; font-size: 10px;")
        self.timer_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        btn_layout = QHBoxLayout()
        for ex_id, color in self.exchange_list.items():
            btn = QPushButton(f"{ex_id.upper()} START")
            btn.setFixedHeight(40)
            btn.setStyleSheet(f"font-weight: bold; background-color: {color}; color: white; border-radius: 5px;")
            btn.clicked.connect(lambda checked, eid=ex_id: self.toggle_exchange(eid))
            btn_layout.addWidget(btn)
            self.buttons[ex_id] = btn

        right_layout.addLayout(btn_layout)
        right_layout.addWidget(self.table)
        main_h_layout.addWidget(right_panel, 2)

    def update_table_headers(self):
        if self.type_combo.currentIndex() == 0:
            self.table.setHorizontalHeaderLabels(["Name", "Symbol", "Spot Price", "Bid (Sell)", "Ask (Buy)", "Spread %", "24h %", "Min Trade (USDT)", "Tags"])
        else:
            self.table.setHorizontalHeaderLabels(["Name", "Symbol", "Mark Price", "Bid (Short)", "Ask (Long)", "Spread %", "24h %", "Min Trade (USDT)", "Tags"])

    def on_type_changed(self):
        # Төрөл солигдоход бүх ажиллаж байгаа биржүүдийг зогсоох
        for eid, worker in self.workers.items():
            if worker.running:
                self.toggle_exchange(eid)
        self.update_table_headers()
        self.table.setRowCount(0)
        self.add_log(f"ℹ️ Market type switched to: {self.type_combo.currentText()}")

    def save_currencies(self, data):
        self.currencies_data = data

    def add_log(self, text):
        self.log_box.append(text)
        # Санах ой дүүрэхээс сэргийлж логийн мөрийг 500-аар хязгаарлах
        if self.log_box.document().blockCount() > 500:
            cursor = self.log_box.textCursor()
            cursor.movePosition(cursor.MoveOperation.Start)
            cursor.select(cursor.SelectionType.BlockUnderCursor)
            cursor.removeSelectedText()
            cursor.deleteChar()

    def show_networks(self, row, col):
        symbol_full = self.table.item(row, 0).text()
        coin = symbol_full.split('/')[0]
        if coin in self.currencies_data:
            networks = self.currencies_data[coin].get('networks', {})
            net_text = f"<h3>{coin} Networks on Binance:</h3><hr>"
            for net_id, net in networks.items():
                status = "✅ Active" if net.get('active') else "❌ Suspended"
                net_text += f"<b>{net.get('name', net_id)}</b> ({status})<br>"
                net_text += f"Address: <code style='color:yellow'>{net.get('address', 'Native/None')}</code><br><br>"
            QMessageBox.information(self, f"{coin} Info", net_text)
        else:
            self.add_log(f"ℹ️ {coin} мэдээлэл олдсонгүй.")

    def toggle_exchange(self, exchange_id):
        any_stopped = False
        for eid, worker in self.workers.items():
            if eid != exchange_id and worker.running:
                worker.running = False
                self.buttons[eid].setText(f"{eid.upper()} START")
                self.buttons[eid].setStyleSheet(f"font-weight: bold; background-color: {self.exchange_list[eid]}; color: white; border-radius: 5px;")
                any_stopped = True
        
        if any_stopped: time.sleep(0.2) # Түр хүлээх

        target_worker = self.workers.get(exchange_id)
        target_btn = self.buttons[exchange_id]
        
        if not target_worker or not target_worker.running:
            # Шинэ worker үүсгэх (Сонгосон төрөлтэй)
            m_type = 'swap' if self.type_combo.currentIndex() == 1 else 'spot'
            worker = ExchangeWorker(exchange_id, m_type)
            worker.data_updated.connect(self.refresh_table)
            worker.log_signal.connect(self.add_log)
            worker.timer_signal.connect(self.timer_label.setText)
            self.workers[exchange_id] = worker
            
            target_worker = worker
            target_worker.running = True
            target_btn.setText(f"{exchange_id.upper()} STOP")
            target_btn.setStyleSheet("font-weight: bold; background-color: #dc3545; color: white; border-radius: 5px;")
            threading.Thread(target=target_worker.run, daemon=True).start()
        else:
            target_worker.running = False
            target_btn.setText(f"{exchange_id.upper()} START")
            target_btn.setStyleSheet(f"font-weight: bold; background-color: {self.exchange_list[exchange_id]}; color: white; border-radius: 5px;")
            self.timer_label.setText("OFF")

    def refresh_table(self, data):
        self.table.setUpdatesEnabled(False)
        self.table.blockSignals(True)
        # Терминал дээрх dataChanged индекс алдааг арилгах хэсэг
        self.table.setCurrentCell(-1, -1) 
        self.table.clearSelection()
        self.table.setSortingEnabled(False)
        
        if self.table.rowCount() != len(data):
            self.table.setRowCount(len(data))
        
        risk_font = QFont("Segoe UI", 9, QFont.Weight.Bold)

        for row, (name, symbol, last, bid, ask, pct, min_usdt, tags, spread) in enumerate(data):
            # Column 0: Name
            item_name = self.table.item(row, 0)
            if not item_name:
                item_name = QTableWidgetItem(name)
                item_name.setForeground(Qt.GlobalColor.gray) # Нэрийг саарал өнгөөр ялгая
                self.table.setItem(row, 0, item_name)
            else:
                item_name.setText(name)

            # Column 1: Symbol
            item_sym = self.table.item(row, 1)
            if not item_sym:
                item_sym = QTableWidgetItem(symbol)
                self.table.setItem(row, 1, item_sym)
            else:
                item_sym.setText(symbol)

            for col, val in enumerate([last, bid, ask, spread, pct, min_usdt, tags], start=2): # start=2 болгов
                price_val = val if val is not None else 0
                
                # Багануудын форматлах
                if col == 8: # Tags
                    price_str = str(val) if val else ""
                elif col == 5: # Spread % column
                    price_str = f"{price_val:.2f}%"
                elif col == 6: # Percentage column
                    price_str = f"{price_val:+.2f}%"
                elif col == 7: # Min Trade (USDT) column
                    price_str = f"{price_val:.2f}" if price_val > 0 else "--"
                else:
                    price_str = f"{price_val:.8f}".rstrip('0').rstrip('.')
                
                item = self.table.item(row, col)
                if not item:
                    # Tags бол текст, бусад нь тоон утгаар эрэмбэлэгдэнэ
                    if col == 8:
                        item = QTableWidgetItem(price_str)
                    else:
                        item = NumericTableWidgetItem(price_str)
                        item.setData(Qt.ItemDataRole.EditRole, price_val)

                    if col == 3: item.setForeground(Qt.GlobalColor.red)
                    if col == 4: item.setForeground(Qt.GlobalColor.green)
                    if col == 5: # Spread color
                        item.setForeground(Qt.GlobalColor.yellow)
                    if col == 6: # Percentage color
                        item.setForeground(Qt.GlobalColor.green if price_val > 0 else (Qt.GlobalColor.red if price_val < 0 else Qt.GlobalColor.white))
                    elif col == 7: # Min Trade color
                        item.setForeground(Qt.GlobalColor.darkGray)
                    self.table.setItem(row, col, item)
                else:
                    item.setText(price_str)
                    if col != 8: 
                        item.setData(Qt.ItemDataRole.EditRole, price_val)

                    if col == 6: # Update color for percentage
                        item.setForeground(Qt.GlobalColor.green if price_val > 0 else (Qt.GlobalColor.red if price_val < 0 else Qt.GlobalColor.white))
                    elif col == 7: # Update color for Min Trade
                        item.setForeground(Qt.GlobalColor.darkGray)
                    elif col == 8: # Tags color update
                        item.setForeground(Qt.GlobalColor.red if price_str else Qt.GlobalColor.white)
                        item.setFont(risk_font if price_str else self.font())

        self.table.setSortingEnabled(True)
        self.table.blockSignals(False)
        self.table.setUpdatesEnabled(True)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyleSheet("QWidget { background-color: #121212; color: white; }")
    window = BinanceSpotApp()
    window.show()
    sys.exit(app.exec())