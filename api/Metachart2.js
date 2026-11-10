(function(){
 const c=document.getElementById("metaChartContainer");
 if(!c)return console.error("[META CHART] #metaChartContainer not found");
 c.innerHTML=`<div id="chart-wrapper" style="position:relative;width:100%;height:100%;min-height:600px;background:#07090d;overflow:hidden;"><canvas id="chart" style="display:block;width:100%;height:100%;cursor:crosshair;"></canvas></div>`;
})();

window.dispatchChartUpdate=function(){};
window.macdMode='normal';   // 'normal' | 'max' | 'min'
window.rsiMode='normal';

function formatPrice(p){
 p=Number(p);
 if(!Number.isFinite(p))return "-";
 if(p>=100)return p.toFixed(2);
 if(p>=1)return p.toFixed(4);
 if(p>=0.001)return p.toFixed(6);
 return p.toPrecision(4);
}

const pad2=n=>String(n).padStart(2,"0");
const TZ8_OFFSET = 8 * 60 * 60 * 1000; // Улаанбаатарын цагийн бүс (UTC+8)

function timeLabel(ts, interval) {
    const d = new Date(Number(ts) + TZ8_OFFSET);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const hours = pad2(d.getUTCHours());
    const minutes = pad2(d.getUTCMinutes());

    if (/[dwM]$/.test(interval)) {
        return d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    }
    return `${day}${month} ${hours}:${minutes}`;
}

function drawLabels(ctx,x,y,items){
 ctx.font="11px Inter, sans-serif";
 ctx.textBaseline="top";
 items.forEach(([label,val,color])=>{
  ctx.fillStyle="#7d8a9c";
  ctx.fillText(label,x,y);
  x+=ctx.measureText(label).width;
  ctx.fillStyle=color||"#e8edf5";
  ctx.fillText(val+"  ",x,y);
  x+=ctx.measureText(val+"  ").width;
 });
}

function activeIndex(m,padding,chartWidth,candleWidth,len){
 if(m&&m.x!==null&&m.x>padding&&m.x<padding+chartWidth){
  const i=Math.floor((m.x-padding)/candleWidth);
  if(i>=0&&i<len)return i;
 }
 return len-1;
}

// --- TECHNICAL INDICATORS (RSI & MACD) ---
function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    let emaArray = [];
    let prevEMA = data[0];
    emaArray.push(prevEMA);
    for (let i = 1; i < data.length; i++) {
        prevEMA = (data[i] * k) + (prevEMA * (1 - k));
        emaArray.push(prevEMA);
    }
    return emaArray;
}

function calculateRSI(closes, period = 14) {
    let rsi = new Array(closes.length).fill(50);
    if (closes.length < period + 1) return rsi;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period; i < closes.length; i++) {
        if (i > period) {
            const diff = closes[i] - closes[i - 1];
            const gain = diff >= 0 ? diff : 0;
            const loss = diff >= 0 ? 0 : -diff;
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }
        if (avgLoss === 0) {
            rsi[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[i] = 100 - (100 / (1 + rs));
        }
    }
    return rsi;
}

function calculateRsiRanges(klines, period, limit = 4) {
    if (!Array.isArray(klines) || klines.length < period + 2) return [];

    const rsi = calculateRSI(klines.map(candle => Number(candle[4])), period);
    const crossings = [];

    for (let index = 1; index < rsi.length - 1; index++) {
        const previousRsi = rsi[index - 1];
        const currentRsi = rsi[index];
        if (!Number.isFinite(previousRsi) || !Number.isFinite(currentRsi)) continue;

        const thresholds = currentRsi > previousRsi ? [30, 70] : [70, 30];
        for (const threshold of thresholds) {
            const crossedUp = previousRsi <= threshold && currentRsi > threshold;
            const crossedDown = previousRsi >= threshold && currentRsi < threshold;
            if (!crossedUp && !crossedDown) continue;

            const fraction = (threshold - previousRsi) / (currentRsi - previousRsi);
            const position = index - 1 + fraction;
            const lastCrossing = crossings[crossings.length - 1];
            if (lastCrossing?.level === threshold) lastCrossing.position = position;
            else crossings.push({ level: threshold, position });
        }
    }

    const ranges = [];
    for (let index = 0; index < crossings.length - 1; index++) {
        ranges.push({
            startPosition: crossings[index].position,
            endPosition: crossings[index + 1].position
        });
    }

    const lastCrossing = crossings[crossings.length - 1];
    const lastClosedCandleEnd = rsi.length - 1;
    if (lastCrossing && lastCrossing.position < lastClosedCandleEnd) {
        ranges.push({
            startPosition: lastCrossing.position,
            endPosition: lastClosedCandleEnd
        });
    }

    return ranges.slice(-limit);
}

function calculateRangeMass(klines, range) {
    let upMass = 0;
    let downMass = 0;
    const firstCandle = Math.max(0, Math.floor(range.startPosition));
    const lastCandle = Math.min(klines.length - 1, Math.ceil(range.endPosition) - 1);

    for (let index = firstCandle; index <= lastCandle; index++) {
        const candle = klines[index];
        const overlap = Math.max(
            0,
            Math.min(range.endPosition, index + 1) - Math.max(range.startPosition, index)
        );
        const open = Number(candle[1]);
        const close = Number(candle[4]);
        if (overlap > 0 && Number.isFinite(open) && Number.isFinite(close)) {
            if (close > open) upMass += (close - open) * overlap;
            else if (close < open) downMass += (open - close) * overlap;
        }
    }

    return { upMass, downMass };
}

function calculateRangeExtremes(klines, range) {
    let hh = null;
    let ll = null;
    const firstCandle = Math.max(0, Math.floor(range.startPosition));
    const lastCandle = Math.min(klines.length - 1, Math.ceil(range.endPosition) - 1);

    for (let index = firstCandle; index <= lastCandle; index++) {
        const candle = klines[index];
        const overlap = Math.min(range.endPosition, index + 1) -
            Math.max(range.startPosition, index);
        const high = Number(candle[2]);
        const low = Number(candle[3]);
        if (overlap <= 0) continue;

        if (Number.isFinite(high) && (hh === null || high > hh.price)) {
            hh = { index, price: high, type: "HH" };
        }
        if (Number.isFinite(low) && (ll === null || low < ll.price)) {
            ll = { index, price: low, type: "LL" };
        }
    }

    return [hh, ll].filter(Boolean);
}

function isRangeExtremeUnbroken(klines, extreme) {
    for (let index = extreme.index + 1; index < klines.length - 1; index++) {
        const close = Number(klines[index][4]);
        if (!Number.isFinite(close)) continue;
        if (extreme.type === "HH" && close > extreme.price) return false;
        if (extreme.type === "LL" && close < extreme.price) return false;
    }

    return true;
}

function calculateBosTrend(bosLevels) {
    const hhCount = bosLevels.filter(level => level.type === "HH").length;
    const llCount = bosLevels.filter(level => level.type === "LL").length;
    const total = hhCount + llCount;

    if (total === 0) return { direction: "NEUTRAL", confidence: 0, hhCount, llCount };
    if (hhCount === llCount) return { direction: "NEUTRAL", confidence: 50, hhCount, llCount };

    const direction = hhCount > llCount ? "SHORT" : "LONG";
    const dominantCount = Math.max(hhCount, llCount);
    const opposingCount = Math.min(hhCount, llCount);
    const confidence = (dominantCount >= 2 && opposingCount === 1)
        ? 100
        : Math.round(50 + 50 * (dominantCount - opposingCount) / total * Math.min(total / 3, 1));

    return { direction, confidence, hhCount, llCount };
}

function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = calculateEMA(closes, fastPeriod);
    const slowEMA = calculateEMA(closes, slowPeriod);
    
    let macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        macdLine.push(fastEMA[i] - slowEMA[i]);
    }
    
    const signalLine = calculateEMA(macdLine, signalPeriod);
    
    let histogram = [];
    for (let i = 0; i < closes.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }
    
    return { macdLine, signalLine, histogram };
}

document.addEventListener("DOMContentLoaded",()=>{
 const canvas=document.getElementById("chart");
 if(!canvas)return;
 const ctx=canvas.getContext("2d");

 const marketEl=document.getElementById("market");
 const intervalEl=document.getElementById("interval");
 const coinEl=document.getElementById("coin");
 const coinListEl=document.getElementById("coinList");
 const settingsButton=document.getElementById("toggleChartSettings");
 const settingsPanel=document.getElementById("chartSettings");
 
 settingsButton?.addEventListener("click",()=>{
  const isOpen=settingsPanel.style.display!=="none";
  settingsPanel.style.display=isOpen?"none":"flex";
  settingsButton.setAttribute("aria-expanded",String(!isOpen));
 });

 ["showRSI","showMACD"].forEach(id=>{
  document.getElementById(id)?.addEventListener("change",draw);
 });

 document.getElementById("applyIndicators")?.addEventListener("click",async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try{
   await window.refreshChartIndicators();
  }catch(error){
   console.error("[INDICATOR UPDATE ERROR]",error);
  }finally{
   button.disabled=false;
  }
 });

 let symbol="BTCUSDT",interval="1m";

 window.allData=[];
 window.rsiArrayData = [];
 window.macdArrayData = [];
 window.signalArrayData = [];
 window.histArrayData = [];
 window.signalEvents=[];

 let visibleCount=500,offset=0;
 const minVisible=20,maxVisible=10000;
 const mouse={x:null,y:null};
 let dragging=false,lastX=0;
 let priceScale=1,priceOffset=0,draggingPrice=false,lastY=0;
 let lastPriceRange=0,lastChartHeight=0;

 const PAD=15,PSW=55;

 function resize(){
  const p=canvas.parentElement;
  canvas.width=p?p.clientWidth:window.innerWidth;
  canvas.height=p?p.clientHeight:window.innerHeight;
  draw();
 }
 window.addEventListener("resize",resize);
 setTimeout(resize,100);

 function draw(){
  if(!window.allData||!window.allData.length)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const padding=PAD,priceScaleWidth=PSW,timeScaleHeight=30;
  const chartHeight=canvas.height-padding*2-timeScaleHeight;
  lastChartHeight=chartHeight;
  const chartWidth=canvas.width-padding*2-priceScaleWidth;

  const end=window.allData.length-offset;
  const start=Math.max(0,end-visibleCount);
  window._chartStartIndex=start;
  const data=window.allData.slice(start,end);
  if(!data.length)return;

  const candleWidth=chartWidth/data.length;

  let maxPrice=-Infinity,minPrice=Infinity;
  data.forEach(d=>{if(d[2]>maxPrice)maxPrice=d[2];if(d[3]<minPrice)minPrice=d[3]});

  if(maxPrice===minPrice){
   const pp=maxPrice>1?maxPrice*0.001:0.001;
   maxPrice+=pp;minPrice-=pp;
  }
  const buf=(maxPrice-minPrice)*0.05;
  maxPrice+=buf;minPrice-=buf;

  if(priceScale!==1){
   const mid=(maxPrice+minPrice)/2,half=(maxPrice-minPrice)/2*priceScale;
   maxPrice=mid+half;minPrice=mid-half;
  }
  lastPriceRange=maxPrice-minPrice;
  maxPrice+=priceOffset;minPrice+=priceOffset;

  const showMacd = document.getElementById("showMACD")?.checked !== false;
  const showRsi = document.getElementById("showRSI")?.checked !== false;
  
  let R = { main: 1, macd: 0, rsi: 0 };

  if (showMacd && showRsi) {
      if (window.macdMode === 'max') {
          R = { main: 0.60, macd: 0.40, rsi: 0 };
      } else if (window.rsiMode === 'max') {
          R = { main: 0.60, macd: 0, rsi: 0.40 };
      } else if (window.macdMode === 'min') {
          R = { main: 0.77, macd: 0.08, rsi: 0.15 };
      } else if (window.rsiMode === 'min') {
          R = { main: 0.77, macd: 0.15, rsi: 0.08 };
      } else {
          R = { main: 0.70, macd: 0.15, rsi: 0.15 };
      }
  } else if (showMacd) {
      if (window.macdMode === 'max') {
          R = { main: 0.60, macd: 0.40, rsi: 0 };
      } else if (window.macdMode === 'min') {
          R = { main: 0.92, macd: 0.08, rsi: 0 };
      } else {
          R = { main: 0.85, macd: 0.15, rsi: 0 };
      }
  } else if (showRsi) {
      if (window.rsiMode === 'max') {
          R = { main: 0.60, macd: 0, rsi: 0.40 };
      } else if (window.rsiMode === 'min') {
          R = { main: 0.92, macd: 0, rsi: 0.08 };
      } else {
          R = { main: 0.85, macd: 0, rsi: 0.15 };
      }
  }
  
  const mainRatio = R.main, macdRatio = R.macd, rsiRatio = R.rsi;
  const mainChartHeight=chartHeight*mainRatio;
  const priceToY=p=>padding+(maxPrice-p)/(maxPrice-minPrice)*mainChartHeight;
  const yToPrice=y=>maxPrice-((y-padding)/mainChartHeight)*(maxPrice-minPrice);
  const rsiPeriod=Number(document.getElementById("rsiPeriod")?.value||14);
  const rsiRanges=calculateRsiRanges(window.allData,rsiPeriod,4);
  const rangeColors=[
   "rgba(255, 61, 87, 0.13)",
   "rgba(33, 150, 243, 0.13)",
   "rgba(34, 197, 94, 0.13)",
   "rgba(255, 193, 7, 0.16)"
  ];
  const massColors=["#ff3d57","#2196f3","#22c55e","#ffc107"];
  ctx.save();
  ctx.beginPath();
  ctx.rect(padding,padding,chartWidth,mainChartHeight);
  ctx.clip();
  rsiRanges.forEach((range,index)=>{
   const left=Math.max(start,range.startPosition);
   const right=Math.min(end,range.endPosition);
   if(left>=right)return;
   const ageFromLatest=rsiRanges.length-1-index;
   ctx.fillStyle=rangeColors[rangeColors.length-1-ageFromLatest];
   const x=padding+(left-start)*candleWidth;
   const width=(right-left)*candleWidth;
   ctx.fillRect(x,padding,width,mainChartHeight);
  });
  ctx.restore();

  /* PRICE GRID */
  ctx.font="11px Inter, sans-serif";
  ctx.strokeStyle="#131822";
  ctx.fillStyle="#6b7a8c";
  for(let i=0;i<=6;i++){
   const price=minPrice+(i/6)*(maxPrice-minPrice),y=priceToY(price);
   ctx.beginPath();ctx.moveTo(padding,y);ctx.lineTo(padding+chartWidth,y);ctx.stroke();
   ctx.fillText(formatPrice(price),padding+chartWidth+6,y+4);
  }

  /* TIME GRID */
  const numTicks=Math.max(2,Math.floor(chartWidth/100));
  const step=Math.ceil(data.length/numTicks);
  ctx.textAlign="center";
  for(let i=0;i<data.length;i+=step){
   const x=padding+i*candleWidth+candleWidth/2;
   ctx.strokeStyle="#131822";
   ctx.beginPath();ctx.moveTo(x,padding);ctx.lineTo(x,padding+mainChartHeight);ctx.stroke();
   ctx.fillStyle="#6b7a8c";
   ctx.fillText(timeLabel(data[i][0],interval),x,padding+chartHeight+20);
  }
  ctx.textAlign="left";

  /* CANDLES */
  data.forEach((d,i)=>{
   const [,open,high,low,close]=d;
   if(!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return;

   const x=padding+i*candleWidth;
   const yO=priceToY(open),yC=priceToY(close),yH=priceToY(high),yL=priceToY(low);
   if(!Number.isFinite(yO) || !Number.isFinite(yC) || !Number.isFinite(yH) || !Number.isFinite(yL)) return;

   const bull=close>=open;
   const candleColor = bull ? "#00bcd4" : "#ff3d57"; 
   const wickColor = bull ? "#00e5ff" : "#ff1744";

   ctx.strokeStyle = wickColor;
   ctx.lineWidth = 1;
   ctx.beginPath();
   ctx.moveTo(x + candleWidth / 2, yH);
   ctx.lineTo(x + candleWidth / 2, yL);
   ctx.stroke();

   ctx.fillStyle = candleColor;
   const bodyWidth = Math.max(1, candleWidth * 0.75);
   ctx.fillRect(
        x + (candleWidth - bodyWidth) / 2,
        Math.min(yO, yC),
        bodyWidth,
        Math.max(1, Math.abs(yO - yC))
   );
  });

  /* Keep each range's HH/LL BOS line until a later closed candle breaks it. */
  const bosLevels=[];
  rsiRanges.forEach((range,index)=>{
   const colorIndex=rangeColors.length-rsiRanges.length+index;
   const color=massColors[colorIndex];
   calculateRangeExtremes(window.allData,range).forEach(extreme=>{
    if(isRangeExtremeUnbroken(window.allData,extreme)){
     bosLevels.push({...extreme,color});
    }
   });
  });
  bosLevels.sort((a,b)=>priceToY(a.price)-priceToY(b.price));
  const bosLabelYs=[];
  bosLevels.forEach(level=>{
   const y=priceToY(level.price);
   if(y<padding||y>padding+mainChartHeight)return;
   const startX=Math.max(padding,padding+(level.index-start+0.5)*candleWidth);
   const endX=padding+chartWidth;
   if(startX>=endX)return;

   ctx.save();
   ctx.strokeStyle=level.color;
   ctx.fillStyle=level.color;
   ctx.lineWidth=1.5;
   ctx.setLineDash([6,4]);
   ctx.beginPath();
   ctx.moveTo(startX,y);
   ctx.lineTo(endX,y);
   ctx.stroke();
   ctx.setLineDash([]);

   let labelY=y;
   const nearestLabel=bosLabelYs.find(existingY=>Math.abs(existingY-labelY)<13);
   if(nearestLabel!==undefined){
    labelY=Math.max(padding+10,nearestLabel-13);
    if(Math.abs(labelY-nearestLabel)<13)labelY=Math.min(padding+mainChartHeight-3,nearestLabel+13);
   }
   bosLabelYs.push(labelY);
   const label=`${level.type} BOS`;
   ctx.font="bold 10px Inter, sans-serif";
   ctx.textAlign="right";
   ctx.textBaseline="middle";
   const labelWidth=ctx.measureText(label).width+8;
   ctx.fillStyle="rgba(7, 9, 13, 0.85)";
   ctx.fillRect(endX-labelWidth-2,labelY-7,labelWidth,14);
   ctx.fillStyle=level.color;
   ctx.fillText(label,endX-6,labelY);
   ctx.restore();
  });

  const bosTrend=calculateBosTrend(bosLevels);
  const trendColor=bosTrend.direction==="SHORT"?"#ff3d57":
   bosTrend.direction==="LONG"?"#22c55e":"#f7d56b";
  const trendText=bosTrend.hhCount+bosTrend.llCount===0
   ?"TREND: NEUTRAL · BOS 0"
   :`TREND: ${bosTrend.direction} ${bosTrend.confidence}% · HH ${bosTrend.hhCount} / LL ${bosTrend.llCount}`;
  ctx.save();
  ctx.font="bold 11px Inter, sans-serif";
  ctx.textAlign="left";
  ctx.textBaseline="middle";
  const trendX=padding+10;
  const trendY=padding+chartHeight-10;
  const trendWidth=ctx.measureText(trendText).width+14;
  ctx.fillStyle="rgba(7, 9, 13, 0.88)";
  ctx.fillRect(trendX-5,trendY-11,trendWidth,22);
  ctx.fillStyle=trendColor;
  ctx.fillText(trendText,trendX+2,trendY);
  ctx.restore();

  /* LAST PRICE LINE */
  const lastClose=data[data.length-1][4],yLast=priceToY(lastClose);
  ctx.setLineDash([4,4]);
  ctx.strokeStyle="#e6b422";
  ctx.beginPath();ctx.moveTo(padding,yLast);ctx.lineTo(padding+chartWidth,yLast);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle="#e6b422";
  ctx.fillText(formatPrice(lastClose),padding+chartWidth+6,yLast-4);

  /* CROSSHAIR & EXACT MOUSE TIME / PRICE */
  if(mouse.x!==null&&mouse.x>padding&&mouse.x<padding+chartWidth&&
      mouse.y!==null&&mouse.y>=padding&&mouse.y<=padding+chartHeight){
   const ci=Math.floor((mouse.x-padding)/candleWidth);
   if(ci>=0&&ci<data.length){
    const candle=data[ci];
    const cx=padding+ci*candleWidth+candleWidth/2;

    // Vertical line
    ctx.save();
    ctx.strokeStyle="rgba(255,255,255,0.15)";
    ctx.lineWidth=1;
    ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(cx,padding);ctx.lineTo(cx,padding+chartHeight);ctx.stroke();
    ctx.restore();

    // Horizontal price line
    if(mouse.y<=padding+mainChartHeight){
     ctx.save();
     ctx.strokeStyle="rgba(255,255,255,0.15)";
     ctx.lineWidth=1;
     ctx.setLineDash([3,3]);
     ctx.beginPath();ctx.moveTo(padding,mouse.y);ctx.lineTo(padding+chartWidth,mouse.y);ctx.stroke();
     ctx.setLineDash([]);
     
     ctx.fillStyle="#161e2a";
     ctx.fillRect(padding+chartWidth,mouse.y-10,priceScaleWidth,20);
     ctx.strokeStyle="#2b394b";
     ctx.strokeRect(padding+chartWidth,mouse.y-10,priceScaleWidth,20);
     
     ctx.fillStyle="#f7d56b";
     ctx.font="bold 11px Inter, sans-serif";
     ctx.textBaseline="middle";
     ctx.fillText(formatPrice(yToPrice(mouse.y)),padding+chartWidth+6,mouse.y);
     ctx.restore();
    }

    // Exact time label box under crosshair
    const ts=Number(candle[0]);
    if(Number.isFinite(ts)){
     const bw=74,bh=20;
     const bx=Math.max(padding,Math.min(cx-bw/2,padding+chartWidth-bw));
     const by=padding+chartHeight+6;
     ctx.save();
     ctx.fillStyle="#131b26";
     ctx.fillRect(bx,by,bw,bh);
     ctx.strokeStyle="#2b394b";
     ctx.strokeRect(bx,by,bw,bh);
     ctx.fillStyle="#e8edf5";
     ctx.font="10px Inter, sans-serif";
     ctx.textAlign="center";
     ctx.textBaseline="middle";
     ctx.fillText(timeLabel(ts,interval),bx+bw/2,by+bh/2);
     ctx.restore();
    }
   }
  }

  /* OHLC HEADER */
  let ac=data[data.length-1];
  if(mouse.x&&mouse.y&&mouse.x>padding&&mouse.x<padding+chartWidth&&mouse.y>padding&&mouse.y<padding+mainChartHeight){
   const idx=Math.floor((mouse.x-padding)/candleWidth);
   if(data[idx])ac=data[idx];
  }
  const cc=ac[4]>=ac[1]?"#00c853":"#ff3d57";
  drawLabels(ctx,padding+10,padding+6,[
   [currentSymbol()+"  O:",formatPrice(ac[1]),cc],
   ["H:",formatPrice(ac[2])],
   ["L:",formatPrice(ac[3])],
   ["C:",formatPrice(ac[4]),cc]
  ]);

  if(rsiRanges.length){
   ctx.save();
   ctx.font="bold 11px Inter, sans-serif";
   ctx.textBaseline="middle";
   ctx.textAlign="center";
   const slotWidth=chartWidth/rsiRanges.length;
   rsiRanges.forEach((range,index)=>{
    const colorIndex=rangeColors.length-rsiRanges.length+index;
    const mass=calculateRangeMass(window.allData,range);
    const label="MASS:";
    const upValue=formatPrice(mass.upMass);
    const downValue=formatPrice(mass.downMass);
    const centerX=padding+slotWidth*(index+0.5);
    ctx.fillStyle="rgba(7, 9, 13, 0.78)";
    ctx.fillRect(centerX-slotWidth/2+3,padding+19,slotWidth-6,19);
    const fullTextWidth=ctx.measureText(`${label} ${upValue}/${downValue}`).width;
    const textScale=Math.min(1,(slotWidth-16)/fullTextWidth);
    let textX=-fullTextWidth/2;
    ctx.save();
    ctx.translate(centerX,padding+28);
    ctx.scale(textScale,1);
    ctx.textAlign="left";
    ctx.fillStyle=massColors[colorIndex];
    ctx.fillText(label,textX,0);
    textX+=ctx.measureText(label).width+4;
    ctx.fillStyle="#22c55e";
    ctx.fillText(upValue,textX,0);
    textX+=ctx.measureText(upValue).width;
    ctx.fillStyle="#d1d5db";
    ctx.fillText("/",textX,0);
    textX+=ctx.measureText("/").width;
    ctx.fillStyle="#ff3d57";
    ctx.fillText(downValue,textX,0);
    ctx.restore();
   });
   ctx.restore();
  }

  if(showMacd)drawMACD(ctx,data,window.macdArrayData,window.signalArrayData,window.histArrayData,padding,chartWidth,chartHeight,candleWidth,mouse,mainChartHeight,macdRatio);
  if(showRsi)drawRSI(ctx,data,window.rsiArrayData,padding,chartWidth,chartHeight,candleWidth,mouse,mainChartHeight,macdRatio,rsiRatio);
 }

 window.redrawChart=draw;

 function currentMarketType(){
  return marketEl ? marketEl.value.toLowerCase() : "spot";
 }

 function currentSymbol(){
  return coinEl && coinEl.value.trim() ? coinEl.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : "BTCUSDT";
 }

 function currentIntervalMinutes() {
    return intervalEl ? intervalEl.value : "1m";
 }

 async function loadExchangeSymbols() {
  try {
      const marketType = currentMarketType();
      let url = marketType === "futures" 
          ? "https://fapi.binance.com/fapi/v1/exchangeInfo"
          : "https://api.binance.com/api/v3/exchangeInfo";

      const res = await fetch(url);
      if(!res.ok) return;
      const data = await res.json();
      
      if(data && data.symbols) {
          const symbols = data.symbols
              .filter(s => s.status === "TRADING" && s.quoteAsset === "USDT")
              .map(s => s.symbol);

          if(coinListEl) {
              coinListEl.innerHTML = symbols.map(sym => `<option value="${sym}">`).join('');
          }
      }
  } catch(e) {
      console.error("Failed to load symbols:", e);
  }
 }

 async function fetchCandles(){
  try{
    symbol = currentSymbol();
    const intervalVal = currentIntervalMinutes(); 
    interval = intervalVal;
    const marketType = currentMarketType();

    let url = marketType === "futures" 
        ? `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${intervalVal}&limit=1000`
        : `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${intervalVal}&limit=1000`;

    const res = await fetch(url);
    if(!res.ok) throw new Error(`Binance API error: HTTP ${res.status}`);
    
    const candleData = await res.json();
    if(!Array.isArray(candleData)) throw new Error("Invalid format from Binance");
    
    window.allData = candleData.map(d => [
        Number(d[0]), Number(d[1]), Number(d[2]), Number(d[3]), Number(d[4]), Number(d[5])
    ]);

    await window.refreshIndicatorArrays();
    draw();
    dispatchChartUpdate();
    startLivePolling(symbol, intervalVal, marketType);
  }catch(e){console.error("[BINANCE CHART ERROR]",e)}
 }

 window.refreshIndicatorArrays = async function() {
    if (!window.allData || !window.allData.length) return;
    const closes = window.allData.map(d => d[4]);
    
    const rsiPeriod = parseInt(document.getElementById("rsiPeriod")?.value || "14", 10);
    window.rsiArrayData = calculateRSI(closes, rsiPeriod);
    
    const macdFast = parseInt(document.getElementById("macdFast")?.value || "12", 10);
    const macdSlow = parseInt(document.getElementById("macdSlow")?.value || "26", 10);
    const macdSignal = parseInt(document.getElementById("macdSignal")?.value || "9", 10);
    
    const macdRes = calculateMACD(closes, macdFast, macdSlow, macdSignal);
    window.macdArrayData = macdRes.macdLine;
    window.signalArrayData = macdRes.signalLine;
    window.histArrayData = macdRes.histogram;
 };

 window.refreshChartIndicators = async function () {
    try {
        await window.refreshIndicatorArrays();
        if (typeof window.redrawChart === "function") window.redrawChart();
    } catch (error) {
        console.error("[INDICATOR UPDATE ERROR]", error);
    }
 };

 let updateTimer=null;
 const triggerAutoUpdate=()=>{
  clearTimeout(updateTimer);
  updateTimer=setTimeout(async()=>{
   offset=0;visibleCount=500;priceScale=1;priceOffset=0;
   await fetchCandles();
  },150);
 };

 if(marketEl) marketEl.addEventListener("change",async ()=>{ 
     await loadExchangeSymbols(); 
     triggerAutoUpdate(); 
 });
 if(intervalEl) intervalEl.addEventListener("change",triggerAutoUpdate);
 if(coinEl){
  coinEl.addEventListener("change",triggerAutoUpdate);
  coinEl.addEventListener("keydown",e=>{if(e.key==="Enter")triggerAutoUpdate()});
 }

 loadExchangeSymbols().then(() => {
     startCountdown(60);
     fetchCandles();
 });

 canvas.addEventListener("mousemove",e=>{
  const rect=canvas.getBoundingClientRect();
  mouse.x=e.clientX-rect.left;
  mouse.y=e.clientY-rect.top;

  if(draggingPrice){
   const dy=e.clientY-lastY;
   lastY=e.clientY;
   priceScale=Math.max(0.1,Math.min(priceScale*(1+dy*0.005),10));
   draw();
   return;
  }

  if(dragging){
   const dx=e.clientX-lastX;
   const cw=(canvas.width-PAD*4-PSW)/visibleCount;
   const move=Math.trunc(dx/cw);
   if(move!==0){
    offset=Math.max(0,Math.min(window.allData.length-visibleCount,offset+move));
    lastX+=move*cw;
   }
   const dy=e.clientY-lastY;
   if(lastChartHeight>0)priceOffset+=dy*(lastPriceRange/lastChartHeight);
   lastY=e.clientY;
  }

  canvas.style.cursor=mouse.x>canvas.width-PAD-PSW?"ns-resize":dragging?"grabbing":"crosshair";
  draw();
 });

 canvas.addEventListener("mousedown",e=>{
  if(mouse.x>canvas.width-PAD-PSW){
   draggingPrice=true;
   lastY=e.clientY;
  }else{
   dragging=true;
   lastX=e.clientX;
   lastY=e.clientY;
  }
 });

 canvas.addEventListener("mouseup",()=>{dragging=draggingPrice=false});
 canvas.addEventListener("mouseleave",()=>{
  dragging=draggingPrice=false;
  mouse.x=null;
  draw();
 });
 canvas.addEventListener("dblclick",()=>{priceScale=1;priceOffset=0;draw()});
 canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  const zoomStep=30;
  visibleCount=Math.max(minVisible,Math.min(maxVisible,visibleCount+(e.deltaY>0?zoomStep:-zoomStep)));
  offset=Math.max(0,Math.min(offset,Math.max(0,window.allData.length-visibleCount)));
  draw();
 },{passive:false});
});

function drawWindowButtons(ctx,topY,chartWidth,padding,maxRef,normRef,minRef){
 const btnY=topY+4;
 const minX=padding+chartWidth-10-14,normX=minX-18,maxX=normX-18;
 window[maxRef]=maxX;window[normRef]=normX;window[minRef]=minX;

 ctx.fillStyle="#131822";
 [maxX,normX,minX].forEach(x=>ctx.fillRect(x,btnY,14,14));

 ctx.fillStyle="#7d8a9c";
 ctx.font="9px Inter, sans-serif";
 ctx.textAlign="center";
 ctx.textBaseline="middle";
 ctx.fillText("▲",maxX+7,btnY+7);
 ctx.fillText("■",normX+7,btnY+7);
 ctx.fillText("▼",minX+7,btnY+7);
 ctx.textAlign="left";
 ctx.textBaseline="top";
}

function drawMACD(ctx,data,macdArray,signalArray,histArray,padding,chartWidth,chartHeight,candleWidth,mouseObj,mainChartHeight,macdRatio){
 if(!macdArray||!macdArray.length)return;

 const macdTop=padding+mainChartHeight+20;
 window._macdTop=macdTop;
 const macdHeight=chartHeight*macdRatio-15;

 const startIdx=(window._chartStartIndex??0)+(macdArray.length-window.allData.length);
 const at=(arr,idx)=>idx>=0&&idx<arr.length?Number(arr[idx])||0:0;

 const vis=[];
 data.forEach((d,i)=>{
  const idx=startIdx+i;
  if(idx>=0&&idx<macdArray.length)vis.push(at(macdArray,idx),at(signalArray,idx),at(histArray,idx));
 });

 let maxM=Math.max(...vis,0),minM=Math.min(...vis,0);
 if(maxM===minM){maxM=1;minM=-1}

 const macdToY=v=>macdTop+macdHeight-((v-minM)/(maxM-minM))*macdHeight;

 ctx.strokeStyle="#131822";
 ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(padding,macdTop);ctx.lineTo(padding+chartWidth,macdTop);ctx.stroke();

 if(window.macdMode!=='min'){
  const yZero=macdToY(0);
  data.forEach((d,i)=>{
   const h=at(histArray,startIdx+i),yVal=macdToY(h);
   ctx.fillStyle=h>=0?"#00c853":"#ff3d57";
   ctx.fillRect(padding+i*candleWidth+candleWidth*0.1,Math.min(yZero,yVal),candleWidth*0.8,Math.max(1,Math.abs(yZero-yVal)));
  });

  [[macdArray,"#29b6f6"],[signalArray,"#ffa726"]].forEach(([arr,color])=>{
   ctx.strokeStyle=color;
   ctx.lineWidth=1.5;
   ctx.beginPath();
   data.forEach((d,i)=>{
    const x=padding+i*candleWidth+candleWidth/2,y=macdToY(at(arr,startIdx+i));
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
   });
   ctx.stroke();
  });
 }

 const g=startIdx+activeIndex(mouseObj,padding,chartWidth,candleWidth,data.length);
 if(g>=0&&g<macdArray.length){
  const m=Number(macdArray[g]||0).toFixed(6);
  const s=Number(signalArray[g]||0).toFixed(6);
  const h=Number(histArray[g]||0).toFixed(6);
  drawLabels(ctx,padding+10,macdTop+6,[
   ["MACD:",m,"#29b6f6"],
   ["Sig:",s,"#ffa726"],
   ["Hist:",h,Number(h)>=0?"#00c853":"#ff3d57"]
  ]);
 }

 drawWindowButtons(ctx,macdTop,chartWidth,padding,'_btnMaxX','_btnNormX','_btnMinX');
}

function drawRSI(ctx,data,rsiArray,padding,chartWidth,chartHeight,candleWidth,mouseObj,mainChartHeight,macdRatio,rsiRatio){
 if(!rsiArray||!rsiArray.length)return;

 const startIdx=(window._chartStartIndex??0)+(rsiArray.length-window.allData.length);
 const rsiTop=padding+mainChartHeight+chartHeight*macdRatio+25;
 window._rsiTop=rsiTop;
 const rsiHeight=chartHeight*rsiRatio-20;
 const rsiToY=v=>rsiTop+rsiHeight-(v/100)*rsiHeight;

 ctx.strokeStyle="#131822";
 ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(padding,rsiTop);ctx.lineTo(padding+chartWidth,rsiTop);ctx.stroke();

 if(window.rsiMode!=='min'){
  ctx.setLineDash([3,3]);
  ctx.strokeStyle="#1f2a38";
  [70,30].forEach(lv=>{
   const y=rsiToY(lv);
   ctx.beginPath();ctx.moveTo(padding,y);ctx.lineTo(padding+chartWidth,y);ctx.stroke();
  });
  ctx.setLineDash([]);

  ctx.strokeStyle="#ab47bc";
  ctx.lineWidth=1.5;
  ctx.beginPath();
  data.forEach((d,i)=>{
   const idx=startIdx+i;
   const x=padding+i*candleWidth+candleWidth/2;
   const v=idx>=0&&idx<rsiArray.length&&rsiArray[idx]!==undefined?rsiArray[idx]:50;
   const y=rsiToY(v);
   i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
 }

 const g=startIdx+activeIndex(mouseObj,padding,chartWidth,candleWidth,data.length);
 if(g>=0&&g<rsiArray.length&&rsiArray[g]!==undefined)
  drawLabels(ctx,padding+10,rsiTop+6,[["RSI:",Number(rsiArray[g]).toFixed(2),"#ab47bc"]]);

 drawWindowButtons(ctx,rsiTop,chartWidth,padding,'_btnRsiMaxX','_btnRsiNormX','_btnRsiMinX');
}

let countdownTimer=null;
let remainingSeconds=60;
let countdownTotalSeconds=60;

function updateCountdownDisplay(sec) {
    const el = document.getElementById("candleCountdown");
    if (!el) return;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startCountdown(totalSeconds) {
    countdownTotalSeconds = totalSeconds > 0 ? totalSeconds : 60;
    remainingSeconds = countdownTotalSeconds - (Math.floor(Date.now() / 1000) % countdownTotalSeconds);
    if (remainingSeconds <= 0) remainingSeconds = countdownTotalSeconds;
    updateCountdownDisplay(remainingSeconds);

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) remainingSeconds = countdownTotalSeconds;
        updateCountdownDisplay(remainingSeconds);
    }, 1000);
}

function startLivePolling(symbol, intervalVal, marketType) {
    let totalSec = 60;
    if (intervalVal.endsWith('s')) totalSec = parseInt(intervalVal, 10);
    else if (intervalVal.endsWith('m')) totalSec = parseInt(intervalVal, 10) * 60;
    else if (intervalVal.endsWith('h')) totalSec = parseInt(intervalVal, 10) * 3600;
    else if (intervalVal.endsWith('d')) totalSec = parseInt(intervalVal, 10) * 86400;

    startCountdown(totalSec);

    if (window._livePollingTimer) clearInterval(window._livePollingTimer);

    window._livePollingTimer = setInterval(async () => {
        if (window._livePollingInFlight) return;
        window._livePollingInFlight = true;
        try {
            let url = marketType === "futures" 
                ? `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${intervalVal}&limit=1000`
                : `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${intervalVal}&limit=1000`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            if (!Array.isArray(data) || !data.length) return;

            window.allData = data.map(d => [Number(d[0]), Number(d[1]), Number(d[2]), Number(d[3]), Number(d[4]), Number(d[5])]);
            await window.refreshIndicatorArrays();

            if (typeof window.redrawChart === 'function') window.redrawChart();
            dispatchChartUpdate();
        } catch(e) {
            console.error("[LIVE POLLING ERROR]", e);
        } finally {
            window._livePollingInFlight = false;
        }
    }, 2000);
}