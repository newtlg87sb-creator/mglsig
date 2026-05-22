import sys
import threading
import ccxt
import time
import json
import os

from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QLabel,
                             QLineEdit, QTableWidget, QTableWidgetItem,
                             QHeaderView, QComboBox, QHBoxLayout, QMenu, QPushButton, QCheckBox)
from PyQt6.QtCore import (pyqtSignal, QTimer, Qt, QThread, QObject, QMetaObject, Q_ARG, pyqtSlot)
from PyQt6.QtGui import QAction, QColor, QFont

# Тоон утгаар зөв эрэмбэлэхэд зориулсан класс
class NumericTableWidgetItem(QTableWidgetItem):
    def __lt__(self, other):
        try:
            v1 = self.data(Qt.ItemDataRole.EditRole)
            v2 = other.data(Qt.ItemDataRole.EditRole)
            if v1 is None: return True
            if v2 is None: return False
            return float(v1) < float(v2)
        except (ValueError, TypeError):
            return super().__lt__(other)

# WebSocket ажиллуулах thread
class ExchangeWebSocketWorker(QObject):
    ticker_updated = pyqtSignal(str, float, float, float)
    ws_connected = pyqtSignal(bool) # Холболтын төлөв мэдээлэх

    def __init__(self, exchange, symbols):
        super().__init__()
        self._exchange = exchange
        self._symbols = symbols
        self._running = True

    def stop(self):
        self._running = False

    def run(self):
        # ЧУХАЛ: ccxt.pro ашиглаагүй үед watch_tickers ажиллахгүй.
        # Тиймээс энэ хэсгийг ажиллах боломжтой болтол WS status-ийг шалгах хэрэгтэй.
        self.ws_connected.emit(False) 
        
        # Хэрэв та ccxt.pro суулгаагүй бол энэ хэсэг ажиллахгүй тул 
        # REST API датаг WS-ийн оронд ашиглах логик нэмсэн.
        if not hasattr(self._exchange, 'watch_tickers'):
            print("WS Error: ccxt.pro (asynchronous) is required for watch_tickers.")
            return

        while self._running:
            try:
                # Асинхрон орчин биш тул энэ нь block хийж магадгүй
                tickers = self._exchange.watch_tickers(self._symbols)
                self.ws_connected.emit(True)
                for symbol, t in tickers.items():
                    if t and t.get('last') is not None:
                        self.ticker_updated.emit(
                            symbol, 
                            float(t.get('last', 0)), 
                            float(t.get('bid', 0)), 
                            float(t.get('ask', 0))
                        )
            except Exception as e:
                self.ws_connected.emit(False)
                time.sleep(5)

# SpotMarketPanel доторх засалтууд:
class SpotMarketPanel(QWidget):
    
    refresh_signal = pyqtSignal()
    data_updated = pyqtSignal(list) # Шинэ өгөгдөл бэлэн болмогц логик руу илгээх

    def __init__(self, main_dashboard=None, creds=None):
        super().__init__()
        self.main_dashboard = main_dashboard

        # Exchange-ийг creds-ээр үүсгэх
        self.exchange = ccxt.kucoin({**(creds or {}),
            'enableRateLimit': True, 
            'options': {'defaultType': 'spot', 'adjustForTimeDifference': True}
        })

        self.price_history = {} 
        self.markets = {}
        self.market_cache = {} # Хөнгөн кэш: {symbol: [min_amount, min_cost]}
        self.all_data = []
        self.is_fetching = False
        self.sort_col = 8 
        self.sort_desc = True
        self.max_coins = 1000
        self.selected_symbol = None
        self.session_initial_prices = {} # Программ ажиллах үеийн үнийг хадгалах
        self.h1_ago_fixed_prices = {} # Биржээс татсан яг 1 цагийн өмнөх үнэ
        self.spread_cache = {}
        self.last_spread_update = 0
        # API ачаалал хянах хувьсагчууд
        self.api_call_count = 0
        self.last_api_reset = time.time()
        self.error_429_count = 0
        self.sentiment_type = "Real%" # Sentiment тооцох төрөл (1h% эсвэл Real%)
        
        # Optimization: Cache Colors and Fonts
        self.CLR_UP = QColor("#22c55e")
        self.CLR_DOWN = QColor("#ef4444")
        self.CLR_GOLD = QColor("#fbbf24")
        self.CLR_SKY = QColor("#38bdf8")
        self.CLR_PINK = QColor("#fb7185")
        self.CLR_WHITE = QColor("#ffffff")
        self.CLR_BG_ACTIVE = QColor("#1e40af")
        self.CLR_BG_ST = QColor("#7f1d1d")
        self.CLR_BG_SPR = QColor("#92400e")
        self.CLR_BG_VOL = QColor("#4c1d95")
        self.CLR_BG_MIN = QColor("#334155")
        self.CLR_BG_LIM = QColor("#4b5563")
        self.CLR_BG_MKT = QColor("#334155")
        self.CLR_TRANS = QColor(0, 0, 0, 0)
        self.HDR_FONT = QFont("Arial", 10, QFont.Weight.Bold)
        self.TEXT_FONT = QFont("Arial", 9)

        self.ws_prices = {}
        self.ws_bids = {}
        self.ws_asks = {}
        self.ws_worker = None
        self.ws_thread = None

        self.ui_timer = QTimer(self)
        self.ui_timer.timeout.connect(self.refresh_table) 
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.start_update)

        # API метрикийг шинэчлэх таймер
        self.api_metrics_timer = QTimer(self)
        self.api_metrics_timer.timeout.connect(self.update_api_metrics)

        # 1 цаг тутамд Кэш шинэчлэх таймер
        self.cache_refresh_timer = QTimer(self)
        self.cache_refresh_timer.timeout.connect(self.force_refresh_cache_bg)
        self.cache_refresh_timer.start(3600000) # 1 hour

        self.init_ui()
        self.load_kucoin_markets()
        self.ui_timer.start(2000)
        self.timer.start(2000)
        self.api_metrics_timer.start(1000) # Таймерыг секунд тутамд ажиллуулна

    def init_ui(self):
        self.setWindowTitle("Kucoin Pro Terminal")
        self.setStyleSheet("background-color: #0f172a;")
        layout = QVBoxLayout(self)

        # Header controls
        controls = QHBoxLayout()
        self.status = QLabel("Connecting Kucoin...")
        self.status.setFont(QFont("Arial", 10, QFont.Weight.Bold))

        # Hides Menu Button
        self.hides_btn = QPushButton("≡ Hides")
        self.hides_btn.setFixedSize(80, 24)
        self.hides_btn.setStyleSheet("""
            QPushButton { background-color: #1e293b; color: #94a3b8; font-size: 10px; border-radius: 4px; border: 1px solid #334155; }
            QPushButton::menu-indicator { image: none; }
            QPushButton:hover { background-color: #334155; color: white; }
        """)
        self.hides_menu = QMenu(self)
        self.hides_menu.setStyleSheet("QMenu { background-color: #1e293b; color: white; border: 1px solid #334155; } QMenu::item:selected { background-color: #3b82f6; }")
        
        self.hide_blacklist_act = QAction("Hide Blacklist", self, checkable=True, checked=True)
        self.hide_spread_act = QAction("Hide Spread", self, checkable=True, checked=True)
        self.hide_vol_low_act = QAction("Hide Low Vol", self, checkable=True, checked=True)
        self.hide_min_high_act = QAction("Hide Min High", self, checkable=True, checked=True)
        self.hide_limit_high_act = QAction("Hide Limit High", self, checkable=True, checked=True)
        
        for act in [self.hide_blacklist_act, self.hide_spread_act, self.hide_vol_low_act, self.hide_min_high_act, self.hide_limit_high_act]:
            act.triggered.connect(self.refresh_table)
            self.hides_menu.addAction(act)
        self.hides_btn.setMenu(self.hides_menu)
        
        # Sentiment тохируулах Combo
        self.sent_combo = QComboBox()
        self.sent_combo.addItems(["Sentiment: 1h%", "Sentiment: Real%"])
        self.sent_combo.setCurrentText("Sentiment: Real%")
        self.sent_combo.setStyleSheet("background: #1e293b; color: #38bdf8; padding: 4px; border-radius: 4px; font-size: 11px;")
        self.sent_combo.currentTextChanged.connect(self.on_sentiment_type_changed)

        self.ticker_search = QLineEdit()
        self.ticker_search.setPlaceholderText(" 🔍 Search Symbols...")
        self.ticker_search.setFixedWidth(130)
        self.ticker_search.setStyleSheet("""
            QLineEdit {
                background: #1e293b; color: white; padding: 8px; 
                border: 1px solid #334155; border-radius: 6px;
            }
        """)
        self.ticker_search.textChanged.connect(self.refresh_table)

        self.refresh_box = QComboBox()
        self.refresh_box.addItems(["1s", "2s", "5s", "10s"])
        self.refresh_box.setCurrentText("2s")
        self.refresh_box.setFixedHeight(24)
        self.refresh_box.setStyleSheet("background: #1e293b; color: white; padding: 2px; border-radius: 4px; font-size: 10px;")
        self.refresh_box.currentTextChanged.connect(self.change_interval)

        self.reset_real_btn = QPushButton("🔄 Reset Real%")
        self.reset_real_btn.setFixedSize(85, 24)
        self.reset_real_btn.setStyleSheet("background-color: #1e293b; color: #fbbf24; font-size: 10px; border-radius: 4px; border: 1px solid #fbbf24;")
        self.reset_real_btn.clicked.connect(self.reset_session_prices)

        self.expand_btn = QPushButton("↕ Maximize")
        self.expand_btn.setFixedSize(90, 24)
        self.expand_btn.setStyleSheet("background-color: #1e293b; color: #38bdf8; font-size: 10px; border-radius: 4px; border: 1px solid #38bdf8;")
        self.expand_btn.clicked.connect(self.toggle_maximize)

        controls.addWidget(self.status)
        controls.addStretch()
        controls.addWidget(self.sent_combo)
        controls.addWidget(self.reset_real_btn)
        controls.addWidget(self.ticker_search)
        controls.addWidget(self.hides_btn)
        controls.addWidget(self.expand_btn)
        controls.addWidget(self.refresh_box)
        layout.addLayout(controls)

        self.ws_status = QLabel("WS: Disconnected")
        self.ws_status.setStyleSheet("color: #64748b; font-size: 11px; margin-right: 15px;")

        # API Monitor Panel (UI-ийн доор нэмэх)
        self.api_monitor_layout = QHBoxLayout()
        self.api_monitor_layout.setContentsMargins(5, 0, 5, 5)
        self.req_label = QLabel("Req: 0/min")
        self.req_label.setStyleSheet("color: #38bdf8; font-size: 11px; margin-right: 10px;")
        self.limit_status = QLabel("Health: 100%")
        self.limit_status.setStyleSheet("color: #22c55e; font-size: 11px; margin-right: 10px;")
        self.error_label = QLabel("429s: 0")
        self.error_label.setStyleSheet("color: #94a3b8; font-size: 11px; margin-right: 15px;")

        self.api_monitor_layout.addWidget(self.ws_status)
        self.api_monitor_layout.addWidget(self.req_label)
        self.api_monitor_layout.addWidget(self.limit_status)
        self.api_monitor_layout.addWidget(self.error_label)
        self.api_monitor_layout.addStretch()
        
        layout.addLayout(self.api_monitor_layout)

        # Table Setup
        self.table = QTableWidget(0, 11) 
        self.table.setHorizontalHeaderLabels([
            "#", "Coin", "Bid", "Ask", "Spread%", "Min $", "Vol", "Real%", "1h%", "24%", "Limit $"
        ])
        
        # Багануудын хэмжээг тогтворжуулж, "түлхэлцэх" хөдөлгөөнийг зогсоох
        header = self.table.horizontalHeader()
        # Бүх багануудыг тэнцүү хувааж сунгах
        header.setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        # # Индекс баганыг ( # ) агуулгаар нь хэмжээг нь тааруулж бусад баганад зай гаргаж болно
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        # Харин Coin нэрэнд арай илүү зай өгөхөөр үлдээж болно
        header.setStretchLastSection(True)

        self.table.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setAttribute(Qt.WidgetAttribute.WA_StaticContents)
        self.table.verticalHeader().setMinimumSectionSize(25)
        self.table.horizontalHeader().setStyleSheet("QHeaderView::section { background-color: #1e293b; color: #94a3b8; padding: 6px; border: none; font-weight: bold; }")
        self.table.horizontalHeader().sectionClicked.connect(self.on_header_clicked)
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)
        self.table.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff) # Хэвтээ jitter-ийг устгах
        
        # STYLE: outline: none нэмж "хайрцаг" харагдахаас сэргийлнэ
        self.table.setStyleSheet("""
            QTableWidget {
                background-color: #0f172a; color: #e2e8f0; gridline-color: #1e293b;
                border: 1px solid #1e293b; outline: none;
            }
            QTableWidget::item { padding: 10px; border-bottom: 1px solid #1e293b; }
            QTableWidget::item:selected { background-color: #334155; color: white; }
        """)
        layout.addWidget(self.table)

        # Footer Table Setup (Fixed Totals at bottom)
        self.footer_table = QTableWidget(1, 11)
        self.footer_table.setFixedHeight(30)
        self.footer_table.horizontalHeader().setVisible(False)
        self.footer_table.verticalHeader().setVisible(False)
        self.footer_table.setShowGrid(False)
        self.footer_table.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.footer_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.footer_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self.footer_table.setStyleSheet("QTableWidget { background-color: #1e293b; color: #cbd5e1; border: none; outline: none; }")
        layout.addWidget(self.footer_table)

    def load_kucoin_markets(self):
        """Кэш файл шалгаж, шаардлагатай бол биржээс мэдээлэл татах гүүр"""
        def task():
            try:
                cache_file = "market_cache.json"
                needs_api_update = True
                
                # 1. Кэш файл байгаа эсэх болон хугацааг шалгах
                if os.path.exists(cache_file):
                    file_age = time.time() - os.path.getmtime(cache_file)
                    if file_age < 3600: # 1 цагаас бага бол
                        try:
                            with open(cache_file, 'r') as f:
                                self.market_cache = json.load(f)
                            # ЧУХАЛ: self.markets-ийг кэш дэх түлхүүрүүдээр дүүргэх хэрэгтэй 
                            # Ингэж байж start_update() цикл эргэж эхэлнэ.
                            if self.market_cache:
                                self.markets = {s: {} for s in self.market_cache.keys()}
                            needs_api_update = False
                            QMetaObject.invokeMethod(self.status, "setText", Qt.ConnectionType.QueuedConnection, Q_ARG(str, f"📦 Loaded from Cache: {len(self.market_cache)} Pairs"))
                        except:
                            needs_api_update = True

                # 2. Шинэчлэх шаардлагатай бол бирж рүү хандах
                if needs_api_update:
                    self.refresh_market_cache_api()
                
                usdt_pairs = [s for s in self.markets.keys() if s.endswith('/USDT')]
                if not self.market_cache: # Хэрэв кэш хоосон бол (анхны удаа)
                    self.refresh_market_cache_api()

                QMetaObject.invokeMethod(self.status, "setText", Qt.ConnectionType.QueuedConnection, Q_ARG(str, f"📡 Online: {len(usdt_pairs)} Pairs"))
                self.start_ws(usdt_pairs)
                
                # Background-оор 1 цагийн өмнөх үнийг татаж эхлэх
                threading.Thread(target=self._fetch_h1_ohlcv_background, args=(usdt_pairs,), daemon=True).start()
            except Exception as e:
                QMetaObject.invokeMethod(self.status, "setText", Qt.ConnectionType.QueuedConnection, Q_ARG(str, f"❌ Market Load Error: {e}"))
        threading.Thread(target=task, daemon=True).start()

    def refresh_market_cache_api(self):
        """Биржээс Market Limits-ийг татаж кэш файл руу хадгалах (Хүнд үйлдэл)"""
        self.markets = self.safe_api_call(self.exchange.load_markets)
        new_cache = {}
        for sym, m in self.markets.items():
            if sym.endswith('/USDT'):
                new_cache[sym] = [
                    m['limits']['amount']['min'] or 0.0,
                    m['limits']['cost']['min'] or 0.0
                ]
        self.market_cache = new_cache
        with open("market_cache.json", 'w') as f:
            json.dump(new_cache, f)

    def force_refresh_cache_bg(self):
        """Цаг болсон үед арын албанд кэш шинэчлэх"""
        threading.Thread(target=self.refresh_market_cache_api, daemon=True).start()

    def safe_api_call(self, func, *args, **kwargs):
        """API хүсэлт бүрийг бүртгэж, алдааг хянах функц"""
        start_time = time.perf_counter()
        try:
            self.api_call_count += 1
            result = func(*args, **kwargs)
            
            # Хариу өгөх хурдыг тооцох (одоогоор ашиглагдахгүй ч ирээдүйд хэрэг болно)
            # resp_time = time.perf_counter() - start_time
            # self.avg_response_time = (self.avg_response_time * 0.9) + (resp_time * 0.1)
            
            return result
        except Exception as e:
            if "429" in str(e): # Rate limit алдаа
                self.error_429_count += 1
                QMetaObject.invokeMethod(self.status, "setText", Qt.ConnectionType.QueuedConnection, Q_ARG(str, "⚠️ RATE LIMIT HIT! Slowing down..."))
            raise e # Алдааг цааш дамжуулна

    def _fetch_h1_ohlcv_background(self, symbols):
        """1 цагийн өмнөх бодит үнийг биржээс татаж түүхэнд нэмэх (Rate limit-д орохгүйгээр)"""
        # Rate limit-ээс айж байгаа бол хугацааг нь 0.5s болгож ихэсгэ
        for sym in symbols:
            if not self.timer.isActive(): break
            try:
                # fetch_ohlcv-г safe_api_call-аар дамжуулна
                ohlcv = self.safe_api_call(self.exchange.fetch_ohlcv, sym, timeframe='1h', limit=2)
                if len(ohlcv) >= 1:
                    self.h1_ago_fixed_prices[sym] = float(ohlcv[0][4])
                time.sleep(0.5) # 0.2-оос 0.5 болгож аюулгүй болгов
            except Exception as e:
                if "429" in str(e): # Too many requests алдаа гарвал 10 сек амрах
                    time.sleep(10)
                else:
                    time.sleep(1)

    @pyqtSlot(bool)
    def update_ws_status(self, connected):
        if connected:
            self.ws_status.setText("WS: Live Stream 🟢 Connected")
            self.ws_status.setStyleSheet("color: #22c55e; font-size: 11px;")
        else:
            self.ws_status.setText("WS: Disconnected (REST Mode)")
            self.ws_status.setStyleSheet("color: #ef4444; font-size: 11px;")

    def start_ws(self, symbols):
        self.ws_thread = QThread()
        self.ws_worker = ExchangeWebSocketWorker(self.exchange, symbols)
        self.ws_worker.moveToThread(self.ws_thread)
        self.ws_worker.ticker_updated.connect(self._update_ws_prices)
        self.ws_worker.ws_connected.connect(self.update_ws_status) # Төлөв холбох
        self.ws_thread.started.connect(self.ws_worker.run)
        self.ws_thread.start()

    def _update_ws_prices(self, symbol, last, bid, ask):
        self.ws_prices[symbol] = last
        self.ws_bids[symbol] = bid
        self.ws_asks[symbol] = ask
        self.ws_status.setText(f"WS: Live Stream 🟢 {symbol}")

    @pyqtSlot()
    def reset_session_prices(self):
        """Программ ажиллаж эхлэх үеийн үнийг тэглэж, Real%-ийг одоогийн үнээс тоолж эхлэх"""
        self.session_initial_prices = {}
        if self.main_dashboard:
            self.main_dashboard.log_signal.emit("🔄 Real% tracker reset to current market prices.")
        self.refresh_table()

    def toggle_maximize(self):
        """Market жагсаалтыг томруулах/багасгах дохиог MainDashboard руу илгээх"""
        if not self.main_dashboard: return
        if self.expand_btn.text() == "↕ Maximize":
            self.expand_btn.setText("↕ Restore")
            self.main_dashboard.maximize_market(True)
        else:
            self.expand_btn.setText("↕ Maximize")
            self.main_dashboard.maximize_market(False)

    def change_interval(self, val):
        self.timer.start(int(val.replace("s", "")) * 1000)

    def on_header_clicked(self, index):
        self.sort_desc = not self.sort_desc if self.sort_col == index else True
        self.sort_col = index
        self.refresh_table()

    def on_sentiment_type_changed(self, val):
        self.sentiment_type = "Real%" if "Real%" in val else "1h%"
        self.refresh_table()

    def start_update(self):
        if self.is_fetching or not self.markets: return
        self.is_fetching = True
        def task():
            try:
                tickers = self.safe_api_call(self.exchange.fetch_tickers, params={'type': 'spot'})
                now = time.time()
                
                # UI Thread-ээс хэрэгтэй мэдээллийг авах
                active_syms = set()
                blacklist = set()
                if self.main_dashboard:
                    active_syms = {s.upper() for s in self.main_dashboard.active_symbols.keys()}
                    blacklist = self.main_dashboard.mgmt.blacklist
                search = self.ticker_search.text().upper()

                raw_list = []
                symbols = [s for s in self.markets.keys() if s.endswith('/USDT') and s in tickers][:self.max_coins]
                for i, sym in enumerate(symbols):
                    t = tickers[sym]
                    # Last price-ийг алгасаж бодит Ask үнийг үндсэн үнээр (lp) авах
                    lp = float(t.get('ask') or t.get('last') or 0.0)
                    
                    # WS ажиллахгүй үед History Panel-д үнэ харуулахын тулд cache-г шинэчлэх
                    self.ws_prices[sym] = lp
                    self.ws_bids[sym] = float(t.get('bid') or 0)
                    self.ws_asks[sym] = float(t.get('ask') or 0)
                    
                    # Программ ажиллах үеийн анхны үнийг нэг удаа хадгалах
                    if sym not in self.session_initial_prices and lp > 0:
                        self.session_initial_prices[sym] = lp

                    if sym not in self.price_history: self.price_history[sym] = []
                    self.price_history[sym].append((now, lp))
                    self.price_history[sym] = [p for p in self.price_history[sym] if now - p[0] <= 3600]
                    
                    h1 = 0.0
                    # Эхлээд биржээс татсан 1 цагийн өмнөх үнийг ашиглахыг оролдоно
                    anchor_p = self.h1_ago_fixed_prices.get(sym)
                    if anchor_p and anchor_p > 0:
                        h1 = ((lp - anchor_p) / anchor_p) * 100
                    elif len(self.price_history[sym]) > 1:
                        old = self.price_history[sym][0][1]
                        if old > 0: h1 = ((lp - old) / old) * 100
                    
                    # Кэш-ээс статик утгуудыг маш хурдан авах
                    m_cache = self.market_cache.get(sym, [0.0, 0.0])
                    min_amount = m_cache[0]
                    limit_val = m_cache[1]
                    
                    # ST болон бусад статусыг мөн адил кэшлэх боломжтой ч, эхний ээлжинд limits-ийг шийдэв
                    is_st = False # Энэ мэдээллийг кэш рүү оруулах боломжтой

                    init_p = self.session_initial_prices.get(sym, lp)
                    real_change = ((lp - init_p) / init_p * 100) if init_p > 0 else 0.0

                    live_bid = self.ws_bids.get(sym, float(t.get('bid') or 0.0))
                    live_ask = self.ws_asks.get(sym, float(t.get('ask') or 0.0))
                    spread = ((live_ask - live_bid) / live_ask * 100) if live_ask > 0 else 0.0
                    val_usd = min_amount * (live_ask if live_ask > 0 else lp)
                    vol = float(t.get("quoteVolume") or 0.0)
                    ch_24 = float(t.get("percentage") or 0.0)

                    display_name = sym.split('/')[0]
                    if is_st: display_name += " [ST]"

                    raw_list.append({
                        "index": i,
                        "symbol": sym, "base": sym.split('/')[0],
                        "display_name": display_name,
                        "last": lp, "h1_change": h1, "real_change": real_change, "change": ch_24,
                        "volume": vol,
                        "live_bid": live_bid, "live_ask": live_ask,
                        "limit": limit_val,
                        "is_st": bool(is_st),
                        "live_spread": spread,
                        "val_usd": val_usd,
                        # Pre-format strings for UI
                        "bid_str": f"{live_bid:.8f}",
                        "ask_str": f"{live_ask:.8f}",
                        "spr_str": f"{spread:.2f}%",
                        "val_str": f"{val_usd:.4f}",
                        "vol_str": f"{vol/1e6:.1f}M" if vol >= 1e6 else f"{vol/1e3:.1f}K",
                        "real_str": f"{real_change:+.2f}%",
                        "h1_str": f"{h1:+.2f}%",
                        "ch_str": f"{ch_24:+.2f}%",
                        "lim_str": str(limit_val)
                    })
                
                self.all_data = raw_list

                # --- HEAVY FILTERING & CATEGORIZATION IN THREAD ---
                act_list, bl_list, spr_list, low_list, min_list, lim_list, mkt_list = [], [], [], [], [], [], []
                
                hide_bl = self.hide_blacklist_act.isChecked()
                hide_spr = self.hide_spread_act.isChecked()
                hide_vol = self.hide_vol_low_act.isChecked()
                hide_min = self.hide_min_high_act.isChecked()
                hide_lim = self.hide_limit_high_act.isChecked()

                for d in raw_list:
                    sym = d['symbol']
                    is_in_search = search in sym
                    if not is_in_search: continue

                    if sym in active_syms or d['base'] in active_syms: act_list.append(d)
                    elif d['is_st'] or sym in blacklist or d['base'] in blacklist: 
                        if not hide_bl: bl_list.append(d)
                    elif d['live_spread'] > 0.3: 
                        if not hide_spr: spr_list.append(d)
                    elif d['volume'] < 30000: 
                        if not hide_vol: low_list.append(d)
                    elif d['limit'] > 0.1: 
                        if not hide_lim: lim_list.append(d)
                    elif d['val_usd'] > 0.11: 
                        if not hide_min: min_list.append(d)
                    else: mkt_list.append(d)

                # Sort within thread
                sort_key_map = {0: 'index', 1:'symbol', 2:'live_bid', 3:'live_ask', 4:'live_spread', 5:'val_usd', 6:'volume', 7:'real_change', 8:'h1_change', 9:'change', 10:'limit'}
                k = sort_key_map.get(self.sort_col, 'volume')
                rev = self.sort_desc
                for g in [act_list, bl_list, spr_list, low_list, min_list, lim_list, mkt_list]:
                    g.sort(key=lambda x: x.get(k, 0) if k!='symbol' else str(x.get(k)).lower(), reverse=rev)

                # Prepare Sentiment Data
                all_visible = act_list + bl_list + spr_list + low_list + min_list + lim_list + mkt_list
                data_key = 'real_change' if self.sentiment_type == "Real%" else 'h1_change'
                ups = len([d for d in all_visible if d.get(data_key, 0) > 0.5])
                dns = len([d for d in all_visible if d.get(data_key, 0) < -0.5])
                
                processed = {
                    'groups': [
                        ("★ ACTIVE", act_list, self.CLR_BG_ACTIVE),
                        ("🚫 BLACKLISTED / ST RISK", bl_list, self.CLR_BG_ST),
                        ("⚠️ HIGH SPREAD (>1.0%)", spr_list, self.CLR_BG_SPR),
                        ("📉 VOLUME LOW (<50K)", low_list, self.CLR_BG_VOL),
                        ("⚖️ MINIMUM HIGH (>0.11)", min_list, self.CLR_BG_MIN),
                        ("🚧 LIMIT HIGH (>0.1)", lim_list, self.CLR_BG_LIM),
                        ("📊 MARKET LIST", mkt_list, self.CLR_BG_MKT)
                    ],
                    'sentiment': (ups, dns),
                    'totals': (
                        sum(d.get('real_change', 0) for d in all_visible),
                        sum(d.get('h1_change', 0) for d in all_visible),
                        sum(d.get('change', 0) for d in all_visible)
                    ),
                    'strategy_list': mkt_list
                }
                
                # UI Thread рүү бэлэн датаг илгээх
                QMetaObject.invokeMethod(self, "refresh_table_optimized", Qt.ConnectionType.QueuedConnection, Q_ARG(dict, processed))
                
            except Exception as e:
                print(f"Update Task Error: {e}")
            finally: self.is_fetching = False
        threading.Thread(target=task, daemon=True).start()

    @pyqtSlot(dict)
    def refresh_table_optimized(self, data):
        """Бэлэн боловсруулсан датаг хүлээн авч, хуучин элементүүдийг устгахгүйгээр байранд нь шинэчлэх"""
        self.table.setUpdatesEnabled(False)  # Зурж байх үед дэлгэцийг түр царцаах (Анивчихаас сэргийлнэ)
        
        # 1. Нийт хэрэгцээт мөрийг тооцоолох
        total_rows = 0
        for title, items, color in data['groups']:
            if items: 
                total_rows += (len(items) + 1)

        # 2. Хүснэгтийн мөрний тоог тааруулах (Гэхдээ setRowCount(0) хийж устгахгүй!)
        if self.table.rowCount() < total_rows:
            self.table.setRowCount(total_rows)  # Хэрэв мөр дутвал нэмнэ
        elif self.table.rowCount() > total_rows:
            # Илүү гарсан мөрүүдийг доороос нь хасаж, хэмжээг тааруулна
            while self.table.rowCount() > total_rows:
                self.table.removeRow(self.table.rowCount() - 1)
        if self.table.rowCount() != total_rows:
            self.table.setRowCount(total_rows)

        curr = 0
        display_idx = 1
        for title, items, color in data['groups']:
            if not items: 
                continue
                
            # Header Row зурах хэсэг
            self.add_header_row(curr, f"  {title} ({len(items)})", color)
            curr += 1
            
            # Data Rows - Энд хуучин мөрүүдийг устгахгүй, зөвхөн утгыг нь өөрчилнө
            for d in items:
                # Хэрэв тухайн мөрний span (нэгдэл) хуучин header-ээс үлдсэн байвал устгаж хэвийн болгоно
                if self.table.columnSpan(curr, 0) > 1:
                    self.table.setSpan(curr, 0, 1, 1)
                    
                self.render_row(curr, display_idx, d, color if curr % 2 == 0 else None)
                curr += 1
                display_idx += 1

        self.update_sentiment_ui(data['sentiment'])
        self.update_footer_totals(*data['totals'])
        
        self.table.setUpdatesEnabled(True)  # Зурж дууссан тул дэлгэцийг буцааж нээнэ
        self.data_updated.emit(data.get('strategy_list', []))

    def update_api_metrics(self):
        now = time.time()
        elapsed = now - self.last_api_reset
        
        # Минут тутамд тоологчийг тэглэх
        if elapsed >= 60: 
            self.api_call_count = 0
            self.last_api_reset = now
            
        # UI шинэчлэх
        self.req_label.setText(f"Req: {self.api_call_count}/min")
        self.error_label.setText(f"429s: {self.error_429_count}")
        
        # Limit Health тооцох (Хэрэв алдаа гарвал эрүүл мэнд буурна)
        health = max(0, 100 - (self.error_429_count * 20)) # 429 алдаа бүр 20% эрүүл мэндийг бууруулна
        self.limit_status.setText(f"Health: {health:.0f}%")
        
        h_clr = "#22c55e" if health > 80 else "#fbbf24" if health > 40 else "#ef4444"
        self.limit_status.setStyleSheet(f"color: {h_clr}; font-size: 11px;")

    def update_sentiment_ui(self, sentiment):
        ups, dns = sentiment
        if ups > dns * 3 and ups > 5:
            sent_text, clr = "🚀 STRONG BULL ↑↑", "#22c55e"
        elif ups > dns * 1.5: sent_text, clr = "📈 BULL ↑", "#4ade80"
        elif dns > ups * 3 and dns > 5: sent_text, clr = "🩸 STRONG BEAR ↓↓", "#ef4444"
        elif dns > ups * 1.5: sent_text, clr = "📉 BEAR ↓", "#f87171"
        else: sent_text, clr = "⚖️ FLAT ↔", "#94a3b8"

        self.status.setText(f"{sent_text} | Up: {ups} | Down: {dns} ({self.sentiment_type})")
        self.status.setStyleSheet(f"color: {clr}; font-weight: bold; font-size: 12px;")

    def add_header_row(self, row, title, bg):
        # Optimization: Reuse existing QPushButton widget to avoid layout flicker
        existing_widget = self.table.cellWidget(row, 0)
        bg_hex = bg.name() if isinstance(bg, QColor) else bg
        
        if isinstance(existing_widget, QPushButton):
            if existing_widget.text() != title:
                existing_widget.setText(title)
                existing_widget.setStyleSheet(f"background: {bg_hex}; color: white; text-align: left; border: none; height: 28px;")
            btn = existing_widget
        else:
            btn = QPushButton(title)
            btn.setFont(self.HDR_FONT)
            btn.setEnabled(False)
            btn.setStyleSheet(f"background: {bg_hex}; color: white; text-align: left; border: none; height: 28px;")
            self.table.setCellWidget(row, 0, btn)
        
        if self.table.columnSpan(row, 0) != 11:
            self.table.setSpan(row, 0, 1, 11)

    @pyqtSlot()
    def refresh_table(self):
        """Хуучин refresh_table-г start_update() руу нэгтгэсэн тул энд юу ч хийхгүй байж болно"""
        pass

    def update_footer_totals(self, real, h1, c24):
        self.footer_table.setSpan(0, 0, 1, 2)
        label = QTableWidgetItem("TOTALS")
        label.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        label.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        self.footer_table.setItem(0, 0, label)

        # Real%
        r_item = QTableWidgetItem(f"{real:+.2f}%")
        r_item.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        r_item.setForeground(QColor("#fbbf24" if real >= 0 else "#f87171"))
        r_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        self.footer_table.setItem(0, 7, r_item)

        # 1h%
        h_item = QTableWidgetItem(f"{h1:+.2f}%")
        h_item.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        h_item.setForeground(QColor("#38bdf8" if h1 >= 0 else "#fb7185"))
        h_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        self.footer_table.setItem(0, 8, h_item)

        # 24%
        c_item = QTableWidgetItem(f"{c24:+.2f}%")
        c_item.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        c_item.setForeground(QColor("#22c55e" if c24 > 0 else "#ef4444"))
        c_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        self.footer_table.setItem(0, 9, c_item)

    def render_row(self, row, display_idx, d, bg_color):
        # Optimization: Reuse QTableWidgetItem objects instead of creating new ones
        def get_or_create(r, c, is_numeric=True):
            item = self.table.item(r, c)
            if not item:
                item = NumericTableWidgetItem("") if is_numeric else QTableWidgetItem("")
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.table.setItem(r, c, item)
            return item

        # 0. Index
        idx = get_or_create(row, 0)
        idx.setText(str(display_idx))
        idx.setData(Qt.ItemDataRole.EditRole, display_idx)
        if bg_color: idx.setBackground(bg_color)
        else: idx.setBackground(self.CLR_TRANS) # Reset to transparent
        
        # 1. Coin Name
        c_item = get_or_create(row, 1, False)
        c_item.setText(d['display_name'])
        c_item.setForeground(self.CLR_DOWN if d['is_st'] else self.CLR_WHITE)

        # 2 & 3. Bid/Ask
        get_or_create(row, 2).setText(d['bid_str'])
        get_or_create(row, 3).setText(d['ask_str'])
        
        # 4. Spread
        s_item = get_or_create(row, 4)
        s_item.setText(d['spr_str'])
        s_item.setForeground(self.CLR_GOLD if d['live_spread'] > 1.0 else self.CLR_WHITE)

        # 5. Min $
        m_item = get_or_create(row, 5)
        m_item.setText(d['val_str'])
        m_item.setForeground(self.CLR_UP if d['val_usd'] <= 0.11 else self.CLR_WHITE)

        # 6. Volume
        get_or_create(row, 6).setText(d['vol_str'])
        
        # 7. Real%
        r_item = get_or_create(row, 7)
        r_item.setText(d['real_str'])
        r_item.setForeground(self.CLR_GOLD if d['real_change'] >= 0 else self.CLR_DOWN)

        # 8. 1h%
        h_item = get_or_create(row, 8)
        h_item.setText(d['h1_str'])
        h_item.setForeground(self.CLR_SKY if d['h1_change'] >= 0 else self.CLR_PINK)

        # 9. 24h%
        ch_item = get_or_create(row, 9, False)
        ch_item.setText(d['ch_str'])
        ch_item.setForeground(self.CLR_UP if d['change'] > 0 else self.CLR_DOWN)
        
        # 10. Limit
        get_or_create(row, 10).setText(d['lim_str'])

    def closeEvent(self, event):
        if self.ws_thread:
            self.ws_worker.stop()
            self.ws_thread.quit()
            self.ws_thread.wait()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    # Fix for QFont setPointSize: Point size <= 0 warning
    app_font = app.font()
    app_font.setPointSize(10)
    app.setFont(app_font)
    
    window = SpotMarketPanel()
    window.resize(1100, 800)
    window.show()
    sys.exit(app.exec())