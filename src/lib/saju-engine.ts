/**
 * 사주(Saju) 엔진 — Python → TypeScript 포팅
 * 60갑자 일주/일진 계산 + 오행 상생상극 + 5운 점수 + 종목 오행 추천
 * 참고: https://github.com/gameworkerkim/vibe-investing/AIInvestor/services/saju_engine.py
 */

// ─── 60갑자 Anchor ───
const ANCHOR_DATE = new Date("1900-01-01");
const ANCHOR_STEM = 0;   // 갑(甲)
const ANCHOR_BRANCH = 10; // 술(戌)

const STEMS_KR = ["갑","을","병","정","무","기","경","신","임","계"];
const STEMS_HJ = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES_KR = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
const BRANCHES_HJ = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

// 천간→오행
const STEM_ELEMENT: Record<number, string> = {
    0:"wood",1:"wood",2:"fire",3:"fire",4:"earth",5:"earth",6:"metal",7:"metal",8:"water",9:"water"
};
const STEM_POLARITY: Record<number, string> = {
    0:"yang",1:"yin",2:"yang",3:"yin",4:"yang",5:"yin",6:"yang",7:"yin",8:"yang",9:"yin"
};
const BRANCH_ELEMENT: Record<number, string> = {
    0:"water",1:"earth",2:"wood",3:"wood",4:"earth",5:"fire",6:"fire",7:"earth",8:"metal",9:"metal",10:"earth",11:"water"
};

const ELEMENT_KR: Record<string, string> = {
    wood:"목(木)",fire:"화(火)",earth:"토(土)",metal:"금(金)",water:"수(水)"
};
const ELEMENT_EMOJI: Record<string, string> = {
    wood:"🌳",fire:"🔥",earth:"⛰️",metal:"⚒️",water:"💧"
};

// 상생/상극
const GENERATES: Record<string, string> = { wood:"fire",fire:"earth",earth:"metal",metal:"water",water:"wood" };
const OVERCOMES: Record<string, string> = { wood:"earth",earth:"water",water:"fire",fire:"metal",metal:"wood" };

type Relation = "bi"|"saeng_in"|"saeng_out"|"geuk_in"|"geuk_out";

const RELATION_KR: Record<Relation, string> = {
    bi:"비화(比和)",saeng_in:"인성(印星)",saeng_out:"식상(食傷)",geuk_in:"관성(官星)",geuk_out:"재성(財星)"
};

// 시지
const HOUR_BRANCH = [0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,0];

// ─── 일주 계산 ───
function dayPillarIndex(d: Date): [number, number] {
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const anchorUtc = Date.UTC(1900, 0, 1);
    const delta = Math.floor((utc - anchorUtc) / 86400000);
    return [(ANCHOR_STEM + delta) % 10, (ANCHOR_BRANCH + delta) % 12];
}

export function dayPillar(d: Date, hour?: number): [number, number] {
    if (hour !== undefined && hour >= 23) {
        d = new Date(d.getTime() + 86400000);
    }
    return dayPillarIndex(d);
}

export function hourBranch(hour: number): number {
    return HOUR_BRANCH[hour % 24];
}

// ─── 년주(年柱) ───
// 입춘(2/4) 기준으로 년주 변경
function yearPillar(year: number): [number, number] {
    const stem = (year - 4) % 10;
    const branch = (year - 4) % 12;
    return [stem, branch];
}

// ─── 월주(月柱) ───
// 월지는 입춘(1월)부터 시작. 0=인, 1=묘, ... 11=축
// 월간: (년간 * 2 + 월) % 10
function monthPillar(yearStem: number, month: number): [number, number] {
    // month: 0=1월, 1=2월, ...
    // 월지: (month + 2) % 12 (입춘=인=2, 경칩=묘=3, ...)
    const mBranch = (month + 2) % 12;
    const mStem = (yearStem * 2 + month) % 10;
    return [mStem, mBranch];
}

// ─── 시주(時柱) ───
// 시지: 2시간 단위 (자=0, 축=1, ...)
// 시간: (일간 * 2 + 시지) % 10
function timePillar(dayStem: number, hour: number): [number, number] {
    const tBranch = HOUR_BRANCH[hour % 24];
    // 시간 인덱스: 자=0, 축=1, ... (시지와 동일)
    const timeIdx = Math.floor(((hour + 1) % 24) / 2);
    const tStem = (dayStem * 2 + timeIdx) % 10;
    return [tStem, tBranch];
}

// ─── 4주 완전 계산 ───
export interface FourPillars {
    year: { stem: number; branch: number; stemKr: string; branchKr: string; stemHj: string; branchHj: string; label: string; element: string };
    month: { stem: number; branch: number; stemKr: string; branchKr: string; stemHj: string; branchHj: string; label: string; element: string };
    day: { stem: number; branch: number; stemKr: string; branchKr: string; stemHj: string; branchHj: string; label: string; element: string };
    time: { stem: number; branch: number; stemKr: string; branchKr: string; stemHj: string; branchHj: string; label: string; element: string } | null;
}

export function calculateFourPillars(birthDate: string, birthHour: number | null): FourPillars {
    const d = new Date(birthDate);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based

    // 년주
    const [yStem, yBranch] = yearPillar(year);

    // 월주 (년간 기준)
    const [mStem, mBranch] = monthPillar(yStem, month);

    // 일주
    const [dStem, dBranch] = dayPillar(d, birthHour ?? undefined);

    // 시주
    let tPillar: FourPillars["time"] = null;
    if (birthHour !== null) {
        const [tStem, tBranch] = timePillar(dStem, birthHour);
        tPillar = {
            stem: tStem, branch: tBranch,
            stemKr: STEMS_KR[tStem], branchKr: BRANCHES_KR[tBranch],
            stemHj: STEMS_HJ[tStem], branchHj: BRANCHES_HJ[tBranch],
            label: `${STEMS_KR[tStem]}${BRANCHES_KR[tBranch]}(${STEMS_HJ[tStem]}${BRANCHES_HJ[tBranch]})`,
            element: STEM_ELEMENT[tStem],
        };
    }

    return {
        year: {
            stem: yStem, branch: yBranch,
            stemKr: STEMS_KR[yStem], branchKr: BRANCHES_KR[yBranch],
            stemHj: STEMS_HJ[yStem], branchHj: BRANCHES_HJ[yBranch],
            label: `${STEMS_KR[yStem]}${BRANCHES_KR[yBranch]}(${STEMS_HJ[yStem]}${BRANCHES_HJ[yBranch]})`,
            element: STEM_ELEMENT[yStem],
        },
        month: {
            stem: mStem, branch: mBranch,
            stemKr: STEMS_KR[mStem], branchKr: BRANCHES_KR[mBranch],
            stemHj: STEMS_HJ[mStem], branchHj: BRANCHES_HJ[mBranch],
            label: `${STEMS_KR[mStem]}${BRANCHES_KR[mBranch]}(${STEMS_HJ[mStem]}${BRANCHES_HJ[mBranch]})`,
            element: STEM_ELEMENT[mStem],
        },
        day: {
            stem: dStem, branch: dBranch,
            stemKr: STEMS_KR[dStem], branchKr: BRANCHES_KR[dBranch],
            stemHj: STEMS_HJ[dStem], branchHj: BRANCHES_HJ[dBranch],
            label: `${STEMS_KR[dStem]}${BRANCHES_KR[dBranch]}(${STEMS_HJ[dStem]}${BRANCHES_HJ[dBranch]})`,
            element: STEM_ELEMENT[dStem],
        },
        time: tPillar,
    };
}

// ─── 오행 관계 ───
export function relationBetween(todayEl: string, myEl: string): Relation {
    if (todayEl === myEl) return "bi";
    if (GENERATES[todayEl] === myEl) return "saeng_in";
    if (GENERATES[myEl] === todayEl) return "saeng_out";
    if (OVERCOMES[todayEl] === myEl) return "geuk_in";
    if (OVERCOMES[myEl] === todayEl) return "geuk_out";
    return "bi";
}

// ─── 5운 점수 ───
const BASE_SCORES: Record<string, Record<Relation, number>> = {
    wealth:   { bi:55, saeng_in:60, saeng_out:65, geuk_in:45, geuk_out:80 },
    business: { bi:60, saeng_in:55, saeng_out:80, geuk_in:50, geuk_out:75 },
    study:    { bi:60, saeng_in:85, saeng_out:50, geuk_in:70, geuk_out:50 },
    love:     { bi:55, saeng_in:60, saeng_out:70, geuk_in:50, geuk_out:75 },
    health:   { bi:70, saeng_in:75, saeng_out:55, geuk_in:45, geuk_out:60 },
};

export const FORTUNE_KEYS = ["wealth","business","study","love","health"] as const;
export type FortuneKey = typeof FORTUNE_KEYS[number];

export const FORTUNE_KR: Record<FortuneKey, string> = {
    wealth:"재물운",business:"사업운",study:"학업운",love:"연애운",health:"건강운"
};

export function fortuneScores(
    relation: Relation,
    dayBranchEl: string,
    todayBranchEl: string
): Record<FortuneKey, number> {
    let bonus = 0;
    if (todayBranchEl === dayBranchEl) bonus = 5;
    else if (OVERCOMES[todayBranchEl] === dayBranchEl) bonus = -5;
    else if (OVERCOMES[dayBranchEl] === todayBranchEl) bonus = 3;

    const out: Record<string, number> = {};
    for (const k of FORTUNE_KEYS) {
        out[k] = Math.max(10, Math.min(95, BASE_SCORES[k][relation] + bonus));
    }
    return out as Record<FortuneKey, number>;
}

// ─── 종목 추천 오행 ───
export function favoredElements(myEl: string, relation: Relation): string[] {
    const meGen = Object.entries(GENERATES).find(([,v]) => v === myEl)?.[0] || "";
    const meGenOut = GENERATES[myEl] || "";
    const meOver = OVERCOMES[myEl] || "";
    if (relation === "geuk_out") return [meOver, myEl, meGenOut].filter(Boolean);
    if (relation === "saeng_out") return [myEl, meGenOut, meOver].filter(Boolean);
    if (relation === "saeng_in") return [meGen, myEl, meGenOut].filter(Boolean);
    if (relation === "geuk_in") return [meGen, myEl].filter(Boolean);
    return [myEl, meGenOut, meGen].filter(Boolean);
}

// ─── 프로필 ───
export interface SajuProfile {
    birthDate: string;
    birthHour: number | null;
    dayStemIdx: number;
    dayBranchIdx: number;
    hourBranchIdx: number | null;
    myElement: string;
    dayBranchElement: string;
    polarity: string;
    stemKr: string;
    branchKr: string;
    stemHj: string;
    branchHj: string;
    iljuLabel: string;
}

export function buildProfile(birthDate: string, birthHour: number | null): SajuProfile {
    const d = new Date(birthDate);
    const [stem, branch] = dayPillar(d, birthHour ?? undefined);
    const hb = birthHour !== null ? hourBranch(birthHour) : null;
    return {
        birthDate,
        birthHour,
        dayStemIdx: stem,
        dayBranchIdx: branch,
        hourBranchIdx: hb,
        myElement: STEM_ELEMENT[stem],
        dayBranchElement: BRANCH_ELEMENT[branch],
        polarity: STEM_POLARITY[stem],
        stemKr: STEMS_KR[stem], branchKr: BRANCHES_KR[branch],
        stemHj: STEMS_HJ[stem], branchHj: BRANCHES_HJ[branch],
        iljuLabel: `${STEMS_KR[stem]}${BRANCHES_KR[branch]}(${STEMS_HJ[stem]}${BRANCHES_HJ[branch]})`,
    };
}

// ─── 오늘의 일진 ───
export interface TodaySaju {
    date: string;
    dayStemIdx: number;
    dayBranchIdx: number;
    todayElement: string;
    todayBranchElement: string;
    relation: Relation;
    fortune: Record<FortuneKey, number>;
    favoredElements: string[];
    relationLabel: string;
    iljuLabel: string;
}

export function todayFor(profile: SajuProfile): TodaySaju {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const [stem, branch] = dayPillarIndex(kst);
    const todayEl = STEM_ELEMENT[stem];
    const todayBr = BRANCH_ELEMENT[branch];
    const rel = relationBetween(todayEl, profile.myElement);
    return {
        date: kst.toISOString().slice(0, 10),
        dayStemIdx: stem,
        dayBranchIdx: branch,
        todayElement: todayEl,
        todayBranchElement: todayBr,
        relation: rel,
        fortune: fortuneScores(rel, profile.dayBranchElement, todayBr),
        favoredElements: favoredElements(profile.myElement, rel),
        relationLabel: RELATION_KR[rel],
        iljuLabel: `${STEMS_KR[stem]}${BRANCHES_KR[branch]}(${STEMS_HJ[stem]}${BRANCHES_HJ[branch]})`,
    };
}

// ─── 한글 요약 ───
function grade(score: number) {
    if (score >= 80) return "매우 좋음";
    if (score >= 65) return "좋음";
    if (score >= 50) return "보통";
    if (score >= 35) return "주의";
    return "약함";
}

export function summaryLines(profile: SajuProfile, today: TodaySaju) {
    const meKr = ELEMENT_KR[profile.myElement];
    const todayKr = ELEMENT_KR[today.todayElement];
    const relPhrase: Record<Relation, string> = {
        bi: "동료·경쟁자가 가까운 날",
        saeng_in: "외부의 도움·기회가 흐르는 날",
        saeng_out: "내 에너지를 표현·소비하는 날",
        geuk_in: "압박·시험·검증이 들어오는 날",
        geuk_out: "내가 주도해 결과를 만드는 날",
    };
    const invFocus: Record<Relation, string> = {
        bi: "동종업·시너지 종목으로 분산. 무리한 추격매수는 자제.",
        saeng_in: "안정·블루칩 위주. 정보·연구·교육 섹터에 기회.",
        saeng_out: "표현·미디어·소비재. 단기 모멘텀에 활동 활발.",
        geuk_in: "방어주·필수소비재·헬스케어. 손절선 명확히 둘 것.",
        geuk_out: "성장·재무 강한 기업. 차익 실현 타이밍 좋음.",
    };

    const w = today.fortune;
    return {
        header: `${meKr} 일간 × 오늘 ${todayKr} 일진 → ${today.relationLabel} · ${relPhrase[today.relation]}`,
        wealth: `${w.wealth}점 (${grade(w.wealth)})`,
        business: `${w.business}점 (${grade(w.business)})`,
        study: `${w.study}점 (${grade(w.study)})`,
        love: `${w.love}점 (${grade(w.love)})`,
        health: `${w.health}점 (${grade(w.health)})`,
        caution: cautionBlurb(today.relation),
        investFocus: invFocus[today.relation],
        disclaimer: "※ 본 사주 풀이는 일주 기준 오행 우세와 오늘 일진의 상생·상극만으로 산출한 간이 결과이며, 명리학의 통변이 완벽하지 않습니다. 실제 투자 시 전문가의 도움이 필요합니다.",
    };
}

function cautionBlurb(rel: Relation): string {
    const map: Record<Relation, string> = {
        bi: "비슷한 의견·동종업과의 충돌, 추격매수 자제.",
        saeng_in: "수동적이 되기 쉬움 — 결정 미루지 말 것.",
        saeng_out: "과소비·과활동 주의, 휴식 챙기기.",
        geuk_in: "스트레스성 결정·손절 회피 주의. 손절선 사수.",
        geuk_out: "욕심 과잉 주의 — 차익 실현 타이밍 놓치지 말 것.",
    };
    return map[rel];
}

// ─── 일주 성격·특징 ───
const ILJU_PERSONALITY: Record<string, { trait: string; weakness: string }> = {
    "갑자(甲子)": { trait:"선견지명과 통찰력이 뛰어나며, 새로운 시작을 두려워하지 않는 개척자 기질", weakness:"고집이 세고 독단적 판단을 내리기 쉬움. 때로는 지나친 독립심이 협업을 방해" },
    "갑술(甲戌)": { trait:"책임감이 강하고 정도를 걷는 원칙주의자. 목표를 향해 꾸준히 나아가는 끈기", weakness:"융통성이 부족해 변화에 적응이 더딤. 완벽주의로 인한 스트레스" },
    "갑신(甲申)": { trait:"지적 호기심이 왕성하고 분석력이 탁월. 기회를 빠르게 포착하는 직관력", weakness:"너무 많은 선택지를 고민하다 결정이 늦어짐. 변덕스러운 면" },
    "갑오(甲午)": { trait:"열정적이고 추진력이 강함. 한 번 결정하면 망설임 없이 실행하는 결단력", weakness:"성급한 결정으로 손실 볼 위험. 감정 기복이 커서 충동적 투자 주의" },
    "갑진(甲辰)": { trait:"포용력이 넓고 리더십이 자연스러움. 사람을 모으고 조직을 키우는 재능", weakness:"남의 부탁을 거절 못해 손해 보는 경우 있음. 우유부단" },
    "갑인(甲寅)": { trait:"진취적이고 도전정신이 강함. 남이 안 가는 길을 개척하는 선구자", weakness:"무모한 도전으로 실패 위험. 현실 감각이 부족할 수 있음" },
    "을축(乙丑)": { trait:"성실하고 인내심이 깊음. 묵묵히 자신의 길을 가는 장인 정신", weakness:"자기표현이 부족해 능력을 인정받지 못할 수 있음. 내성적 경향" },
    "을묘(乙卯)": { trait:"감수성이 풍부하고 예술적 재능. 부드러운 카리스마로 사람을 이끎", weakness:"감정에 휘둘려 비합리적 결정. 현실 도피 성향" },
    "을사(乙巳)": { trait:"지혜롭고 임기응변에 능함. 복잡한 문제를 단순화하는 통찰력", weakness:"신비주의적 성향으로 현실 감각 이탈. 우유부단" },
    "을미(乙未)": { trait:"온화하고 배려심 깊음. 안정적인 관계를 중시하는 신뢰형", weakness:"변화를 싫어해 기회를 놓침. 수동적 태도" },
    "을유(乙酉)": { trait:"논리적이고 분석적 사고. 디테일에 강하고 정확성 추구", weakness:"비판적 태도가 과해 인간관계 마찰. 소심한 면" },
    "을해(乙亥)": { trait:"직관과 통찰이 뛰어남. 물 흐르듯 상황에 적응하는 유연함", weakness:"우유부단하고 책임 회피 성향. 현실 도피" },
    "병자(丙子)": { trait:"밝고 적극적인 성격. 카리스마와 열정으로 주변을 밝힘", weakness:"충동적 소비·투자 경향. 감정적 의사결정" },
    "병술(丙戌)": { trait:"정의감이 강하고 원칙을 중시. 안정적이고 신뢰받는 스타일", weakness:"보수적 성향으로 기회를 놓침. 융통성 부족" },
    "병신(丙申)": { trait:"재치 있고 임기응변에 능함. 혁신적 아이디어가 풍부", weakness:"끈기가 부족하고 쉽게 싫증냄. 변덕" },
    "병오(丙午)": { trait:"강한 추진력과 열정. 목표를 향해 직진하는 카리스마", weakness:"무리한 추진으로 번아웃 위험. 공격적 성향" },
    "병진(丙辰)": { trait:"자존심이 강하고 리더십이 뛰어남. 카리스마 있는 리더", weakness:"독선적 판단. 남의 말을 안 듣는 경향" },
    "병인(丙寅)": { trait:"활발하고 개방적이며 새로운 시도를 즐김", weakness:"한 가지에 집중하지 못하고 산만함" },
    "정축(丁丑)": { trait:"꼼꼼하고 성실한 타입. 신중하게 계획을 세워 실행", weakness:"소심함과 우유부단. 지나친 걱정" },
    "정묘(丁卯)": { trait:"섬세하고 예술적 감각이 뛰어남. 창의적 문제 해결", weakness:"예민함과 감정 기복. 우울증 경향" },
    "정사(丁巳)": { trait:"열정적이고 추진력 있음. 카리스마 있는 행동파", weakness:"욱하는 성격에 충동적 행동. 과로" },
    "정미(丁未)": { trait:"온화하고 사람을 잘 챙김. 배려심 깊은 리더십", weakness:"의존적 성향. 자기주장 부족" },
    "정유(丁酉)": { trait:"논리적이고 분석적. 정확한 판단력", weakness:"비판적·냉소적 태도. 인간관계 어려움" },
    "정해(丁亥)": { trait:"직관과 감성이 조화로움. 깊은 통찰력", weakness:"현실 감각 부족. 이상주의" },
    "무자(戊子)": { trait:"안정감 있고 신뢰받는 스타일. 꾸준함이 강점", weakness:"고집과 보수적 성향. 변화 거부" },
    "무술(戊戌)": { trait:"신의와 책임감이 강함. 든든한 버팀목", weakness:"융통성 없고 답답한 면. 스트레스" },
    "무신(戊申)": { trait:"현실적이고 실용적인 판단. 적응력이 좋음", weakness:"너무 현실적이어서 큰 꿈을 못 그림" },
    "무오(戊午)": { trait:"적극적이고 진취적. 도전을 즐기는 열정", weakness:"무모한 투자·도전. 충동적" },
    "무진(戊辰)": { trait:"포용력과 안정감. 사람을 끌어당기는 매력", weakness:"우유부단하고 남에게 휘둘림" },
    "무인(戊寅)": { trait:"독립심이 강하고 자수성가형. 진취적", weakness:"고집과 독선. 협업 어려움" },
    "기축(己丑)": { trait:"성실하고 내실을 다지는 스타일. 신뢰감", weakness:"소극적·방어적. 기회 놓침" },
    "기묘(己卯)": { trait:"유연하고 적응력 좋음. 부드러운 리더십", weakness:"원칙 없이 흔들리는 경향" },
    "기사(己巳)": { trait:"계산적이고 전략적 사고. 빈틈없음", weakness:"계산이 지나쳐 인간미 부족" },
    "기미(己未)": { trait:"온화하고 양보하는 성품. 안정적", weakness:"소극적·의존적. 자기 목소리 부족" },
    "기유(己酉)": { trait:"꼼꼼하고 체계적. 완벽주의적 실행력", weakness:"지나친 완벽주의로 진도가 안 나감" },
    "기해(己亥)": { trait:"직관력과 통찰력. 감성과 이성의 조화", weakness:"현실 도피 성향. 우유부단" },
    "경자(庚子)": { trait:"결단력 있고 추진력 강함. 목표 달성형", weakness:"냉정하고 독단적. 인간관계 소홀" },
    "경술(庚戌)": { trait:"의리 있고 신뢰받는 성격. 공정함", weakness:"융통성 부족. 지나친 원칙주의" },
    "경신(庚申)": { trait:"두뇌 회전이 빠르고 임기응변. 혁신적", weakness:"변덕스럽고 집중력 부족" },
    "경오(庚午)": { trait:"추진력과 결단력. 실행력이 뛰어남", weakness:"성급하고 충동적. 과로 위험" },
    "경진(庚辰)": { trait:"카리스마와 리더십. 결단력과 포용력", weakness:"독선적·고집. 융통성 부족" },
    "경인(庚寅)": { trait:"진취적이고 도전적. 개척자 정신", weakness:"무모한 도전. 충돌 잦음" },
    "신축(辛丑)": { trait:"꼼꼼하고 치밀함. 완벽주의적 성향", weakness:"비판적이고 까다로움. 소통 어려움" },
    "신묘(辛卯)": { trait:"섬세하고 예술적 감각. 깔끔한 처리", weakness:"예민하고 날카로운 성격" },
    "신사(辛巳)": { trait:"논리적이고 분석적. 날카로운 통찰력", weakness:"냉소적·비판적. 외로움" },
    "신미(辛未)": { trait:"온화하지만 내적으로 강함. 신중함", weakness:"소극적·우유부단" },
    "신유(辛酉)": { trait:"정확성과 완벽 추구. 전문가적 기질", weakness:"지나친 자기비판. 스트레스" },
    "신해(辛亥)": { trait:"직관과 이성의 조화. 영감이 뛰어남", weakness:"현실과 동떨어진 이상" },
    "임자(壬子)": { trait:"지혜롭고 통찰력 있음. 유연한 사고", weakness:"변덕과 우유부단. 집중력 부족" },
    "임술(壬戌)": { trait:"신중하고 책임감 강함. 믿을 수 있는 사람", weakness:"보수적·변화 거부" },
    "임신(壬申)": { trait:"아이디어가 풍부하고 창의적. 적응력", weakness:"끈기 부족. 쉽게 포기" },
    "임오(壬午)": { trait:"열정적이고 추진력 있음. 카리스마", weakness:"지나친 열정으로 번아웃. 충동적" },
    "임진(壬辰)": { trait:"대범하고 포용력 있음. 큰 그릇", weakness:"세부적인 것 소홀. 우유부단" },
    "임인(壬寅)": { trait:"호기심 많고 탐구적. 새로운 것 선호", weakness:"산만하고 집중력 부족" },
    "계축(癸丑)": { trait:"내성적이지만 끈기 있음. 신중한 투자", weakness:"소극적·발전 더딤" },
    "계묘(癸卯)": { trait:"감수성 풍부하고 창의적. 예술적 재능", weakness:"현실 감각 부족. 우울" },
    "계사(癸巳)": { trait:"직관과 지혜. 임기응변에 능함", weakness:"신비주의. 현실 도피" },
    "계미(癸未)": { trait:"온화하고 이해심 많음. 안정적", weakness:"의존적·소극적" },
    "계유(癸酉)": { trait:"논리적·분석적. 정확한 판단", weakness:"비판적·차가운 인상" },
    "계해(癸亥)": { trait:"직관과 영감의 달인. 물처럼 유연", weakness:"현실 도피. 우유부단" },
};

export function getPersonality(iljuLabel: string): { trait: string; weakness: string } {
    return ILJU_PERSONALITY[iljuLabel] || { trait:"균형 잡힌 성격의 소유자로, 상황에 따라 유연하게 대처하는 능력", weakness:"때로는 우유부단하고 결정을 미루는 경향이 있음" };
}

// ─── 월간 운세 (30일 평균 + 트렌드) ───
export function monthlyFortune(profile: SajuProfile): {
    average: Record<FortuneKey, number>;
    bestDay: string;
    worstDay: string;
    trend: "up" | "down" | "flat";
    trendLabel: string;
} {
    const scores: Record<FortuneKey, number[]> = { wealth:[], business:[], study:[], love:[], health:[] };
    let maxDay = "", minDay = "";
    let maxScore = 0, minScore = 100;

    // 오늘부터 30일간 시뮬레이션
    const start = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    for (let i = 0; i < 30; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const [stem, branch] = dayPillarIndex(d);
        const todayEl = STEM_ELEMENT[stem];
        const todayBr = BRANCH_ELEMENT[branch];
        const rel = relationBetween(todayEl, profile.myElement);
        const fs = fortuneScores(rel, profile.dayBranchElement, todayBr);
        const avg = Object.values(fs).reduce((a, b) => a + b, 0) / 5;
        if (avg > maxScore) { maxScore = avg; maxDay = d.toISOString().slice(0, 10); }
        if (avg < minScore) { minScore = avg; minDay = d.toISOString().slice(0, 10); }
        for (const k of FORTUNE_KEYS) scores[k].push(fs[k]);
    }

    const average = {} as Record<FortuneKey, number>;
    for (const k of FORTUNE_KEYS) {
        average[k] = Math.round(scores[k].reduce((a, b) => a + b, 0) / scores[k].length);
    }

    // 트렌드: 전반기(0-14) vs 후반기(15-29) 평균 비교
    let firstHalf = 0, secondHalf = 0;
    for (const k of FORTUNE_KEYS) {
        firstHalf += scores[k].slice(0, 15).reduce((a, b) => a + b, 0) / 15;
        secondHalf += scores[k].slice(15).reduce((a, b) => a + b, 0) / 15;
    }
    const diff = secondHalf - firstHalf;
    const trend = diff > 3 ? "up" : diff < -3 ? "down" : "flat";
    const trendLabel = trend === "up" ? "📈 상승 곡선 — 후반으로 갈수록 운세가 좋아집니다"
        : trend === "down" ? "📉 하락 곡선 — 초반에 집중하고 후반은 방어적으로"
        : "➡️ 안정적 흐름 — 큰 변동 없이 유지됩니다";

    return { average, bestDay: maxDay, worstDay: minDay, trend, trendLabel };
}

// ─── 주간 운세 (7일) ───
export function weeklyFortune(profile: SajuProfile): {
    average: Record<FortuneKey, number>;
    bestDay: string;
    worstDay: string;
    trend: "up" | "down" | "flat";
    trendLabel: string;
} {
    const scores: Record<FortuneKey, number[]> = { wealth:[], business:[], study:[], love:[], health:[] };
    let maxDay = "", minDay = "";
    let maxScore = 0, minScore = 100;

    const start = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const [stem, branch] = dayPillarIndex(d);
        const todayEl = STEM_ELEMENT[stem];
        const todayBr = BRANCH_ELEMENT[branch];
        const rel = relationBetween(todayEl, profile.myElement);
        const fs = fortuneScores(rel, profile.dayBranchElement, todayBr);
        const avg = Object.values(fs).reduce((a, b) => a + b, 0) / 5;
        if (avg > maxScore) { maxScore = avg; maxDay = d.toISOString().slice(0, 10); }
        if (avg < minScore) { minScore = avg; minDay = d.toISOString().slice(0, 10); }
        for (const k of FORTUNE_KEYS) scores[k].push(fs[k]);
    }

    const average = {} as Record<FortuneKey, number>;
    for (const k of FORTUNE_KEYS) {
        average[k] = Math.round(scores[k].reduce((a, b) => a + b, 0) / scores[k].length);
    }

    const mid = Math.round(scores.wealth.slice(0,3).reduce((a,b)=>a+b,0)/3);
    const late = Math.round(scores.wealth.slice(3).reduce((a,b)=>a+b,0)/4);
    const diff = late - mid;
    const trend = diff > 3 ? "up" : diff < -3 ? "down" : "flat";
    const trendLabel = trend === "up" ? "📈 주 후반 상승세" : trend === "down" ? "📉 주 후반 하락세" : "➡️ 안정적 흐름";

    return { average, bestDay: maxDay, worstDay: minDay, trend, trendLabel };
}

// ─── 연간 운세 (세운 기반) ───
// 2026년 = 병오년(丙午) → 천간 2(병), 지지 6(오), 오행 fire
const YEAR_STEM = 2; // 병(丙) → fire
const YEAR_ELEMENT = "fire";
const YEAR_LABEL = "병오년(丙午年)";

export function yearlyFortune(profile: SajuProfile, nickname?: string): {
    yearLabel: string;
    yearElement: string;
    relation: Relation;
    narrative: string;
} {
    const rel = relationBetween(YEAR_ELEMENT, profile.myElement);
    const meKr = ELEMENT_KR[profile.myElement];
    const yearKr = ELEMENT_KR[YEAR_ELEMENT];
    const name = nickname || "당신";

    const narrativeMap: Record<Relation, string> = {
        geuk_out: `${meKr} 일간인 ${name}에게 2026 ${YEAR_LABEL}은 특별한 해입니다. 올해의 화(火) 기운이 당신을 도와 재물운과 성취운이 강하게 열리는 해예요. 적극적인 투자와 도전이 결실을 맺는 시기입니다. 사업적으로는 새로운 기회가 많이 찾아오며, 과감한 결정이 좋은 결과로 이어질 거예요. 건강은 체력 소모가 클 수 있으니 무리하지 말고 휴식을 챙기세요. 연애운도 활발해져 새로운 인연이나 관계의 진전을 기대할 수 있습니다. 투자 성향은 공격적으로 가져가도 좋지만, 차익 실현 타이밍을 놓치지 않는 게 중요해요. 특히 여름(6-8월)에 큰 기회가 올 거예요. 주의할 점은 너무 욕심을 부리면 역효과가 날 수 있다는 점, 그리고 주변의 조언에 귀 기울이는 지혜가 필요합니다.`,

        saeng_out: `${meKr} 일간인 당신에게 2026 ${YEAR_LABEL}은 당신의 에너지를 밖으로 표현하는 한 해입니다. 새로운 아이디어와 창의적인 도전이 빛을 발하는 시기예요. 투자보다는 자기 계발과 능력 향상에 집중하면 더 큰 결실을 얻을 수 있어요. 사업적으로는 혁신적인 시도를 해보기 좋은 해입니다. 다만 체력 소모가 크니 건강 관리에 특히 신경 써야 해요. 연애운은 솔직한 감정 표현이 통하는 해로, 새로운 만남보다는 기존 관계를 발전시키는 데 유리합니다. 투자는 단기 트레이딩보다는 장기 가치 투자에 적합한 성향이에요.`,

        saeng_in: `${meKr} 일간인 당신에게 2026 ${YEAR_LABEL}은 도움과 지원이 넘치는 한 해입니다. 주변에서 좋은 인연과 기회가 찾아올 거예요. 학업과 자기 계발에 특히 유리한 시기라 새로운 공부나 자격증에 도전해보세요. 재물운은 안정적인 흐름이라 저축과 안전 자산 중심의 투자가 좋습니다. 사업은 멘토나 파트너의 도움으로 성장할 수 있어요. 건강은 회복력이 좋은 해라 컨디션이 전반적으로 양호합니다. 연애는 신뢰를 쌓아가는 안정적인 관계에 유리해요. 주의할 점은 수동적인 태도로 기회를 놓치지 않도록 적극성을 유지하는 것입니다.`,

        bi: `${meKr} 일간인 당신에게 2026 ${YEAR_LABEL}은 동료와의 협력이 중요한 한 해입니다. 혼자보다는 함께할 때 더 큰 힘을 발휘할 수 있어요. 재물운은 큰 변동 없이 안정적으로 흘러가며, 무리한 투자보다는 꾸준한 적립식 투자가 적합합니다. 사업은 파트너십과 네트워킹을 통해 확장하는 게 좋아요. 건강은 평소 루틴을 잘 유지하면 무난하게 지나갈 거예요. 연애운은 친구에서 연인으로 발전할 가능성이 높은 해입니다. 투자 성향은 동종 업종에 분산 투자하는 전략이 잘 맞아요. 경쟁자와의 마찰을 피하고 협력의 기회로 삼는 지혜가 필요합니다.`,

        geuk_in: `${meKr} 일간인 당신에게 2026 ${YEAR_LABEL}은 시험과 도전이 있는 한 해입니다. 압박 속에서도 성장할 수 있는 기회로 삼으세요. 재물운은 다소 보수적으로 가져가야 할 때라 현금 비중을 늘리고 리스크 관리를 철저히 해야 해요. 사업은 내부 점검과 체질 개선에 집중하는 게 좋습니다. 건강은 스트레스 관리가 핵심이니 명상이나 운동으로 긴장을 풀어주세요. 연애는 갈등이 생길 수 있으니 인내심을 가지고 대화하는 게 중요합니다. 직장에서는 승진이나 평가 같은 중요한 관문이 있을 수 있어요. 투자는 방어주·필수소비재처럼 안정적인 종목이 적합하고, 손절선을 반드시 지키는 습관을 들이세요.`,
    };

    return {
        yearLabel: YEAR_LABEL,
        yearElement: yearKr,
        relation: rel,
        narrative: narrativeMap[rel],
    };
}

// ═══════════════════════════════════════════════════════════
// 고급 사주 기능 — v1.3.0
// ═══════════════════════════════════════════════════════════

// ─── 십신(十神) ───
// 일간(기준) vs 다른 천간의 음양·오행 관계로 결정
// 비견(比肩): 같은 오행+같은 음양 | 겁재(劫財): 같은 오행+다른 음양
// 식신(食神): 내가 생하는 오행+같은 음양 | 상관(傷官): 내가 생하는 오행+다른 음양
// 정재(正財): 내가 극하는 오행+다른 음양 | 편재(偏財): 내가 극하는 오행+같은 음양
// 정관(正官): 나를 극하는 오행+다른 음양 | 편관(偏官): 나를 극하는 오행+같은 음양
// 정인(正印): 나를 생하는 오행+다른 음양 | 편인(偏印): 나를 생하는 오행+같은 음양

export type SipSinKey = "비견"|"겁재"|"식신"|"상관"|"정재"|"편재"|"정관"|"편관"|"정인"|"편인";

export function getSipSin(dayStem: number, otherStem: number): SipSinKey {
    const dayEl = STEM_ELEMENT[dayStem];
    const otherEl = STEM_ELEMENT[otherStem];
    const samePol = STEM_POLARITY[dayStem] === STEM_POLARITY[otherStem]; // 같은 음양?

    if (dayEl === otherEl) return samePol ? "비견" : "겁재";                          // same element
    if (GENERATES[dayEl] === otherEl) return samePol ? "식신" : "상관";               // I generate it
    if (OVERCOMES[dayEl] === otherEl) return samePol ? "편재" : "정재";               // I overcome it
    if (OVERCOMES[otherEl] === dayEl) return samePol ? "편관" : "정관";               // it overcomes me
    if (GENERATES[otherEl] === dayEl) return samePol ? "편인" : "정인";               // it generates me
    return "비견";
}

export interface SipSinResult {
    fourPillars: Record<string, SipSinKey[]>; // year/month/day/time → [주요십신, ...]
    summary: string;
}

export function calculateSipSin(fourPillars: ReturnType<typeof calculateFourPillars>): SipSinResult {
    const dayStem = fourPillars.day.stem;
    const result: Record<string, SipSinKey[]> = {};

    for (const k of ["year","month","day","time"] as const) {
        const p = fourPillars[k];
        if (!p) continue;
        result[k] = [getSipSin(dayStem, p.stem)];
        // 지지 기준 십신 (일지와의 관계)
        if (k === "time" || k === "year" || k === "month") {
            const branchEl = BRANCH_ELEMENT[p.branch];
            // 지지 십신 간이 계산
            if (branchEl === STEM_ELEMENT[dayStem]) result[k].push(SAME_POLARITY_SIPSIN(dayStem, p.stem));
        }
    }

    // 요약
    const all = Object.values(result).flat();
    const unique = [...new Set(all)];
    const summary = `일간 ${STEMS_KR[dayStem]}${STEMS_HJ[dayStem]} 기준 십신: ${unique.join("·")}`;

    return { fourPillars: result, summary };
}

function SAME_POLARITY_SIPSIN(dayStem: number, otherStem: number): SipSinKey {
    const same = STEM_POLARITY[dayStem] === STEM_POLARITY[otherStem];
    return same ? "비견" : "겁재";
}

// ─── 지장간(支藏干) ───
// 각 지지에는 1-3개의 숨은 천간이 있음 (여기·중기·정기)
const JIJANGGAN: Record<number, { stems: number[]; elements: string[] }> = {
    0:  { stems: [9], elements: ["water"] },                                 // 자(子) → 계(癸)
    1:  { stems: [5,9,6], elements: ["earth","water","metal"] },             // 축(丑) → 기·계·신
    2:  { stems: [0,2,4], elements: ["wood","fire","earth"] },               // 인(寅) → 갑·병·무
    3:  { stems: [1], elements: ["wood"] },                                   // 묘(卯) → 을(乙)
    4:  { stems: [4,1,9], elements: ["earth","wood","water"] },               // 진(辰) → 무·을·계
    5:  { stems: [2,4,6], elements: ["fire","earth","metal"] },               // 사(巳) → 병·무·경
    6:  { stems: [3,5], elements: ["fire","earth"] },                          // 오(午) → 정·기
    7:  { stems: [5,3,1], elements: ["earth","fire","wood"] },                 // 미(未) → 기·정·을
    8:  { stems: [6,4,8], elements: ["metal","earth","water"] },               // 신(申) → 경·무·임
    9:  { stems: [7], elements: ["metal"] },                                   // 유(酉) → 신(辛)
    10: { stems: [4,7,3], elements: ["earth","metal","fire"] },                // 술(戌) → 무·신·정
    11: { stems: [8,0], elements: ["water","wood"] },                          // 해(亥) → 임·갑
};

export function getJijanggan(branchIdx: number): { stems: string[]; elements: string[] } {
    const j = JIJANGGAN[branchIdx] || { stems: [], elements: [] };
    return {
        stems: j.stems.map(s => STEMS_KR[s]),
        elements: j.elements,
    };
}

// ─── 합충형해(合沖刑害) ───
// 육합(六合): 자축·인해·묘술·진유·사신·오미
const YUKHAP: Record<number, number> = { 0:1,1:0, 2:11,11:2, 3:10,10:3, 4:9,9:4, 5:8,8:5, 6:7,7:6 };

// 충(沖): 자오·축미·인신·묘유·진술·사해 (180도 반대)
const CHUNG: Record<number, number> = { 0:6,6:0, 1:7,7:1, 2:8,8:2, 3:9,9:3, 4:10,10:4, 5:11,11:5 };

// 형(刑): 지지 간 불화
const HYUNG: Record<number, number[]> = { 2:[5,2],5:[2,5], 8:[2,8,0],0:[8,0], 1:[10,4,1],10:[1,4],4:[1,10,4], 3:[9,3],9:[3,9], 6:[7,6,11],7:[6,7],11:[6,11] };

// 원진(怨嗔)/파(破): 자유·축오·인사·묘진·신해·술미
const PA: Record<number, number> = { 0:9,9:0, 1:6,6:1, 2:5,5:2, 3:4,4:3, 8:11,11:8, 10:7,7:10 };

export interface HapChungResult {
    pairs: string[];  // "년주-월주: 육합" 형식
}

export function calculateHapChung(fp: ReturnType<typeof calculateFourPillars>): HapChungResult {
    const pillars = [
        { name: "년주", branch: fp.year.branch },
        { name: "월주", branch: fp.month.branch },
        { name: "일주", branch: fp.day.branch },
        { name: "시주", branch: fp.time?.branch ?? -1 },
    ].filter(p => p.branch >= 0);

    const pairs: string[] = [];
    for (let i = 0; i < pillars.length; i++) {
        for (let j = i + 1; j < pillars.length; j++) {
            const a = pillars[i].branch, b = pillars[j].branch;
            if (YUKHAP[a] === b) pairs.push(`${pillars[i].name}·${pillars[j].name}: 육합(${BRANCHES_KR[a]}${BRANCHES_KR[b]})`);
            if (CHUNG[a] === b) pairs.push(`⚠ ${pillars[i].name}·${pillars[j].name}: 충(${BRANCHES_KR[a]}${BRANCHES_KR[b]})`);
            if (PA[a] === b) pairs.push(`${pillars[i].name}·${pillars[j].name}: 파(${BRANCHES_KR[a]}${BRANCHES_KR[b]})`);
        }
    }
    return { pairs: pairs.length > 0 ? pairs : ["특별한 합·충·형·해 없음"] };
}

// ─── 12운성(十二運星) ───
// 일간 기준으로 각 지지에서의 생애 주기
// 순서: 장생·목욕·관대·건록·제왕·쇠·병·사·묘·절·태·양
const TWELVE_STAGES = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"];

// 양간(갑병무경임)의 장생 지지: 해(11), 인(2), 인(2), 사(5), 신(8)
// 음간(을정기신계)의 장생 지지: 오(6), 유(9), 유(9), 자(0), 묘(3)
const YANG_START: Record<number, number> = { 0:11, 2:2, 4:2, 6:5, 8:8 }; // 갑해,병인,무인,경사,임신
const YIN_START: Record<number, number> = { 1:6, 3:9, 5:9, 7:0, 9:3 };   // 을오,정유,기유,신자,계묘

export function getTwelveStage(dayStem: number, branch: number): string {
    const isYang = STEM_POLARITY[dayStem] === "yang";
    let startBranch: number;
    if (isYang) {
        startBranch = YANG_START[dayStem] ?? 11;
        // 양간: 시계방향(순행)
        const offset = (branch - startBranch + 12) % 12;
        return TWELVE_STAGES[offset];
    } else {
        startBranch = YIN_START[dayStem] ?? 6;
        // 음간: 반시계방향(역행)
        const offset = (startBranch - branch + 12) % 12;
        return TWELVE_STAGES[offset];
    }
}

export interface TwelveResult {
    pillars: Record<string, string>; // "년주": "장생", ...
}

export function calculateTwelveStages(fp: ReturnType<typeof calculateFourPillars>): TwelveResult {
    const dayStem = fp.day.stem;
    const result: Record<string, string> = {};
    const names = { year: "년주", month: "월주", day: "일주", time: "시주" };
    for (const k of ["year","month","day","time"] as const) {
        const p = fp[k];
        if (!p) continue;
        result[names[k]] = getTwelveStage(dayStem, p.branch);
    }
    return { pillars: result };
}

// ─── 신강/신약 판단 ───
// 간이: 4주의 오행 중 일간과 같은 오행(비겁)+생하는 오행(인성) 개수
export function calculateStrength(fp: ReturnType<typeof calculateFourPillars>): {
    level: "신강" | "중간" | "신약";
    score: number;
    detail: string;
} {
    const dayEl = fp.day.element;
    const dayStem = fp.day.stem;
    let support = 0, total = 4;

    for (const k of ["year","month","day","time"] as const) {
        const p = fp[k];
        if (!p) { total--; continue; }
        // 일간과 같은 오행 = 비겁 (+2)
        if (p.element === dayEl) support += 2;
        // 일간을 생하는 오행 = 인성 (+1)
        else if (GENERATES[p.element] === dayEl) support += 1;
        // 월지 보정 (월령)
        if (k === "month") {
            const mBranchEl = BRANCH_ELEMENT[p.branch];
            if (mBranchEl === dayEl) support += 1;
            else if (GENERATES[mBranchEl] === dayEl) support += 1;
        }
    }

    const ratio = support / (total * 2);
    const level = ratio > 0.55 ? "신강" : ratio < 0.35 ? "신약" : "중간";
    const detail = `일간 ${STEMS_KR[dayStem]}${STEMS_HJ[dayStem]}(${ELEMENT_KR[dayEl]}) — 득세 ${support}/${total*2} (${Math.round(ratio*100)}%)`;

    return { level, score: Math.round(ratio * 100), detail };
}

// ─── 용신/희신/기신 ───
// 신강 → 용신=극하는(관성)+빼내는(식상)+소모(재성) / 기신=비겁+인성
// 신약 → 용신=도와주는(인성)+비견 / 기신=극하는+빼내는
export interface YongSinResult {
    yongsin: string[];   // 가장 필요한 오행
    heesin: string[];    // 보조 오행
    gisin: string[];     // 피해야 할 오행
    explanation: string;
}

export function calculateYongSin(fp: ReturnType<typeof calculateFourPillars>): YongSinResult {
    const { level } = calculateStrength(fp);
    const dayEl = fp.day.element;
    const allElements = ["wood","fire","earth","metal","water"];

    if (level === "신강") {
        // 신강 → 용신: 관성(나를 극)+식상(내가 생)+재성(내가 극함)
        const overcomeBy = allElements.filter(e => OVERCOMES[e] === dayEl);       // 관성
        const iGenerate = allElements.filter(e => dayEl === GENERATES[dayEl] ? false : GENERATES[dayEl] === e).filter(Boolean);  // 식상
        const iOvercome = allElements.filter(e => OVERCOMES[dayEl] === e);        // 재성
        const yongsin = [...new Set([...overcomeBy, ...iGenerate, ...iOvercome])];
        const gisin = [dayEl, ...allElements.filter(e => GENERATES[e] === dayEl)]; // 비겁+인성
        return {
            yongsin,
            heesin: allElements.filter(e => !yongsin.includes(e) && !gisin.includes(e)),
            gisin,
            explanation: `신강체질 — ${ELEMENT_KR[dayEl]} 기운이 강하므로 용신(부족한 기운)은 ${yongsin.map(e=>ELEMENT_KR[e]).join("·")}입니다.`,
        };
    } else if (level === "신약") {
        // 신약 → 용신: 인성(나를 생)+비겁(같은 오행)
        const generateMe = allElements.filter(e => GENERATES[e] === dayEl);        // 인성
        const yongsin = [dayEl, ...generateMe]; // 비겁+인성
        const gisin = allElements.filter(e => OVERCOMES[e] === dayEl || OVERCOMES[dayEl] === e); // 관성+재성
        return {
            yongsin,
            heesin: allElements.filter(e => !yongsin.includes(e) && !gisin.includes(e)),
            gisin,
            explanation: `신약체질 — ${ELEMENT_KR[dayEl]} 기운이 약하므로 용신(도움이 되는 기운)은 ${yongsin.map(e=>ELEMENT_KR[e]).join("·")}입니다.`,
        };
    }
    return {
        yongsin: ["wood","water"],
        heesin: ["fire"],
        gisin: ["metal"],
        explanation: `중간체질 — 균형이 잘 잡혀 있어 특별한 용신이 필요하지 않습니다.`,
    };
}

// ─── 대운(大運) ───
// 순행/역행 + 10년 주기 = 월주에서 시작
export interface DaeUnEntry {
    age: string;        // "0-9세"
    stem: number; branch: number;
    label: string;
    element: string;
    stage: string;      // 12운성
    sipSin: SipSinKey;  // 십신
}
export function calculateDaeUn(fp: ReturnType<typeof calculateFourPillars>): DaeUnEntry[] {
    const dayStem = fp.day.stem;
    const monthStem = fp.month.stem;
    const monthBranch = fp.month.branch;
    const isYang = STEM_POLARITY[dayStem] === "yang";

    // 순행/역행 판단
    const forward = isYang;

    const entries: DaeUnEntry[] = [];
    let stem = monthStem, branch = monthBranch;

    for (let decade = 0; decade < 8; decade++) {
        // 다음 대운: 순행 → 천간+1 지지+1, 역행 → 천간-1 지지-1
        if (decade > 0) {
            stem = forward ? (stem + 1) % 10 : (stem + 9) % 10;
            branch = forward ? (branch + 1) % 12 : (branch + 11) % 12;
        }
        const startAge = decade * 10;
        entries.push({
            age: `${startAge}-${startAge + 9}세`,
            stem, branch,
            label: `${STEMS_KR[stem]}${BRANCHES_KR[branch]}(${STEMS_HJ[stem]}${BRANCHES_HJ[branch]})`,
            element: STEM_ELEMENT[stem],
            stage: getTwelveStage(dayStem, branch),
            sipSin: getSipSin(dayStem, stem),
        });
    }
    return entries;
}
