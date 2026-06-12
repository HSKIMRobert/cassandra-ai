/**
 * @description GitHub Actions에서 호출되는 API 엔드포인트
 * 퀀트 계산을 수행하고 결과를 반환
 * 배치 잡에서 콜백으로 사용
 */
import { NextResponse } from "next/server";
import { calculateRegime, calculateMomentum, momentumSignal, calculateHedgeWeight } from "@/lib/quant-calc";

export async function GET() {
    const result: any = { timestamp: new Date().toISOString() };

    // ARDS-X 시뮬레이션 (실제 price/volume 데이터가 없으므로 더미로 시연)
    const dummyPrices = Array.from({ length: 100 }, (_, i) => 19000 + Math.sin(i * 0.1) * 2000 + i * 2);
    const ma20 = dummyPrices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ma60 = dummyPrices.slice(-60).reduce((a, b) => a + b, 0) / 60;
    const rsi = Math.min(100, Math.max(0, 45 + Math.random() * 20));
    const volume = 1200000 + Math.random() * 800000;
    const volumeSMA = 1000000;
    const vix = 15 + Math.random() * 20;

    const regime = calculateRegime(dummyPrices[99], ma20, ma60, rsi, volume, volumeSMA, vix);
    const momentum = calculateMomentum(dummyPrices, 20);
    const signal = momentumSignal(momentum);
    const hedge = calculateHedgeWeight(regime.regime);

    result.ardsX = { regime, vix: Math.round(vix * 10) / 10 };
    result.amqs = { momentum: Math.round(momentum * 100) / 100, signal, price: Math.round(dummyPrices[99]) };
    result.hedge = hedge;
    result.backtest = {
        scenario: "기본 시뮬레이션 (실제 종목 아님)",
        note: "chartJs 더미 데이터 / 실거래 연동 시 백테스트 로그 기록"
    };

    return NextResponse.json(result);
}
