# 퀀트 전략 백테스트 방법론

## ARDS-X Regime Classifier

### 계산 방식
```
Regime = f(VIX, MA20/60, RSI(14), Volume SMA)
- 0 (하락): VIX > 30, Price < MA60, RSI < 30
- 1 (횡보): 20 < VIX < 30, MA20 ≈ MA60, 30 < RSI < 70
- 2 (상승): VIX < 20, Price > MA20, RSI > 50
- 3 (급등): VIX < 15, Price > MA20, RSI > 70, Volume > 2x SMA
```

### 백테스트 시나리오
1. 기간: 2023-01-01 ~ 2024-12-31 (2년)
2. 대상: NASDAQ Top 100
3. 전략: Regime 2,3 → 매수 / Regime 0 → 현금 / Regime 1 → 관망
4. 기대: Sharpe Ratio > 1.0, Max Drawdown < 15%

## AMQS / AMQS-M7

### 계산 방식
```
Momentum = (Price_t / Price_{t-20} - 1) * 100
Signal = Momentum > 5 → BUY, Momentum < -5 → SELL
Weight = Equal Weight (초기) → Momentum Weight (월간 리밸런싱)
```

### 백테스트 시나리오
1. 대상: NVDA, TSMC, SK Hynix, Samsung, ASML, AMD, QCOM
2. 진입: 20일 모멘텀 > 5%
3. 청산: 20일 모멘텀 < -5%
4. 리밸런싱: 매월 1일
5. 기대: CAGR > 30%, Sharpe > 1.5

## ARDS 헤지

### 계산 방식
```
AMQS-M7 Long: 65% (고정)
Hedge (KOSDAQ150 Inverse): Regime=0 → 35%, Regime≥1 → 0%
Safe (국고채): Regime=0 → 0%, Regime≥1 → 35%
Cap: Median(비중) + 15%
```

### 백테스트 시나리오
1. 시나리오 A: 강세장 (2023)
2. 시나리오 B: 약세장 (2022)
3. 시나리오 C: 횡보장 (2024 H1)
4. 기대: Max Drawdown < 10%, Sharpe > 1.2
