import sys
import ccxt
import threading
import time
from PyQt6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, 
                             QHBoxLayout, QTableWidget, QTableWidgetItem, 
                             QPushButton, QHeaderView, QWidget, QTextEdit, QLabel, QMessageBox)
from PyQt6.QtCore import pyqtSignal, QObject, Qt
from datetime import datetime

class NumericTableWidgetItem(QTableWidgetItem):
    def __lt__(self, other):
        try:
            return float(self.data(Qt.ItemDataRole.EditRole)) < float(other.data(Qt.ItemDataRole.EditRole))
        except:
            return super().__lt__(other)

class BinanceWorker(QObject):
    data_updated = pyqtSignal(list)
    log_signal = pyqtSignal(str)
    timer_signal = pyqtSignal(str)
    currencies_signal = pyqtSignal(dict) # Сүлжээний мэдээлэл дамжуулах
    
    def __init__(self):
        super().__init__()
        self.exchange = ccxt.binance({
            'enableRateLimit': True
        })
        self.running = False

    def run(self):
        def log(msg): self.log_signal.emit(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
        
        update_interval = 5
        try:
            log("Binance-аас мэдээлэл татаж байна...")
            markets = self.exchange.load_markets()
            
            # Сүлжээний мэдээллийг нэг удаа татаж аваад UI руу илгээнэ
            try:
                currencies = self.exchange.fetch_currencies()
                self.currencies_signal.emit(currencies)
                log("Сүлжээний мэдээллүүд шинэчлэгдлээ.")
            except:
                log("⚠️ Сүлжээ татахад API Key шаардлагатай эсвэл алдаа гарлаа.")

            symbols = [s for s, m in markets.items() if m['active'] and m['type'] == 'spot' and m['quote'] == 'USDT']
            log(f"Нийт {len(symbols)} USDT хос олдлоо.")

            while self.running:
                start_time = time.time()
                self.timer_signal.emit("LIVE")
                tickers = self.exchange.fetch_tickers() 
                display_data = []
                
                for symbol in symbols:
                    if symbol in tickers:
                        t = tickers[symbol]
                        display_data.append([symbol, t.get('last'), t.get('bid'), t.get('ask')])
                
                self.data_updated.emit(display_data)
                
                elapsed = time.time() - start_time
                sleep_time = max(0, update_interval - elapsed)
                
                for i in range(int(sleep_time * 10)):
                    if not self.running: break
                    rem = sleep_time - (i * 0.1)
                    self.timer_signal.emit(f"{rem:.1f}s")
                    time.sleep(0.1)
        except Exception as e:
            log(f"⚠️ Алдаа: {str(e)}")
            self.running = False

class BinanceSpotApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Binance Spot Live + Network Info")
        self.resize(1000, 750)
        self.currencies_data = {} # Сүлжээний мэдээлэл хадгалах

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_h_layout = QHBoxLayout(central_widget)

        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.addWidget(QLabel("LOGS / ERRORS"))
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setStyleSheet("background-color: #000; color: #ff4444; font-family: 'Consolas'; font-size: 11px;")
        left_layout.addWidget(self.log_box)
        main_h_layout.addWidget(left_panel, 1)

        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        self.start_btn = QPushButton("START SCANNING")
        self.start_btn.setFixedHeight(50)
        self.start_btn.setStyleSheet("font-weight: bold; background-color: #28a745; color: white;")
        self.start_btn.clicked.connect(self.toggle_scan)
        right_layout.addWidget(self.start_btn)

        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["Symbol (Click for Networks)", "Last Price", "Bid (Sell)", "Ask (Buy)"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSortingEnabled(True)
        self.table.verticalHeader().setFixedWidth(45)
        
        # Хүснэгтийн нүдэн дээр дарахад ажиллах
        self.table.cellClicked.connect(self.show_networks)
        
        self.timer_label = QLabel("OFF", self.table)
        self.timer_label.setGeometry(0, 0, 45, 32)
        self.timer_label.setStyleSheet("color: #00ff00; background-color: #333; font-weight: bold; font-size: 10px;")
        self.timer_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        right_layout.addWidget(self.table)
        main_h_layout.addWidget(right_panel, 2)

        self.worker = BinanceWorker()
        self.worker.data_updated.connect(self.refresh_table)
        self.worker.log_signal.connect(self.add_log)
        self.worker.timer_signal.connect(self.timer_label.setText)
        self.worker.currencies_signal.connect(self.save_currencies)

    def save_currencies(self, data):
        self.currencies_data = data

    def show_networks(self, row, col):
        # Зөвхөн Symbol багана дээр дарахад харуулна
        symbol_full = self.table.item(row, 0).text()
        coin = symbol_full.split('/')[0]
        
        if coin in self.currencies_data:
            networks = self.currencies_data[coin].get('networks', {})
            net_text = f"<h3>{coin} Networks on Binance:</h3><hr>"
            for net_id, net in networks.items():
                status = "✅ Active" if net.get('active') else "❌ Suspended"
                net_text += f"<b>{net.get('name', net_id)}</b> ({status})<br>"
                net_text += f"ID: {net.get('id')}<br>"
                net_text += f"Address: <code style='color:yellow'>{net.get('address', 'Native/None')}</code><br><br>"
            
            QMessageBox.information(self, f"{coin} Info", net_text)
        else:
            self.add_log(f"ℹ️ {coin} сүлжээний мэдээлэл олдсонгүй (API Key хэрэгтэй байж магадгүй).")

    def add_log(self, text):
        self.log_box.append(text)

    def toggle_scan(self):
        if not self.worker.running:
            self.worker.running = True
            self.start_btn.setText("STOP SCANNING")
            self.start_btn.setStyleSheet("background-color: #dc3545; color: white;")
            threading.Thread(target=self.worker.run, daemon=True).start()
        else:
            self.worker.running = False
            self.start_btn.setText("START SCANNING")
            self.start_btn.setStyleSheet("background-color: #28a745; color: white;")

    def refresh_table(self, data):
        self.table.setSortingEnabled(False)
        self.table.setRowCount(len(data))
        for row, (symbol, last, bid, ask) in enumerate(data):
            self.table.setItem(row, 0, QTableWidgetItem(symbol))
            for col, val in enumerate([last, bid, ask], start=1):
                price_val = val if val is not None else 0
                price_str = f"{price_val:.8f}".rstrip('0').rstrip('.')
                item = NumericTableWidgetItem(price_str)
                item.setData(Qt.ItemDataRole.EditRole, price_val)
                if col == 2: item.setForeground(Qt.GlobalColor.red)
                if col == 3: item.setForeground(Qt.GlobalColor.green)
                self.table.setItem(row, col, item)
        self.table.setSortingEnabled(True)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyleSheet("QWidget { background-color: #121212; color: white; }")
    window = BinanceSpotApp()
    window.show()
    sys.exit(app.exec())