import DashboardStatCard from "./components/DashboardStatCard.jsx"
import styles from "./DashboardPage.module.css"
import { useState } from "react"
import DashboardUsageChart from "./components/DashboardUsageChart.jsx"

const PERIOD_INFO = {
    daily: {
        title: "시간대별 경로 검색 요청",
        description: "오늘 하루 동안 발생한 시간대별 경로 검색 요청입니다."
    },
    monthly: {
        title: "요일별 경로 검색 추이",
        description: "선택한 월의 요일별 경로 검색 요청 추이입니다."
    },
    yearly: {
        title: "월별 경로 검색 추이",
        description: "선택한 연도의 월별 경로 검색 요청 추이입니다."
    },
};

const DAILY_DATA = [
  { label: "00~02", value: 12 },
  { label: "02~04", value: 7 },
  { label: "04~06", value: 8 },
  { label: "06~08", value: 17 },
  { label: "08~10", value: 42 },
  { label: "10~12", value: 31 },
  { label: "12~14", value: 28 },
  { label: "14~16", value: 34 },
  { label: "16~18", value: 39 },
  { label: "18~20", value: 56, highlight: true },
  { label: "20~22", value: 47 },
  { label: "22~24", value: 29 },
];

const MONTHLY_DATA = [
  { label: "월", value: 165 },
  { label: "화", value: 182 },
  { label: "수", value: 174 },
  { label: "목", value: 201 },
  { label: "금", value: 238, highlight: true },
  { label: "토", value: 215 },
  { label: "일", value: 148 },
];

const YEARLY_DATA = [
  { label: "1월", value: 1380 },
  { label: "2월", value: 1240 },
  { label: "3월", value: 1560 },
  { label: "4월", value: 1720 },
  { label: "5월", value: 1890 },
  { label: "6월", value: 2130 },
  { label: "7월", value: 2350 },
  { label: "8월", value: 2670, highlight: true },
  { label: "9월", value: 2280 },
  { label: "10월", value: 2470 },
  { label: "11월", value: 2190 },
  { label: "12월", value: 1980 },
];

function DashboardPage() {
  const [period, setPeriod] = useState("daily");
  const currentPeriod = PERIOD_INFO[period];
  const chartData = {
    daily: DAILY_DATA,
    monthly: MONTHLY_DATA,
    yearly: YEARLY_DATA,
  }[period];

  return (
    <div className={styles.dashboard}>
      <section className={styles.statGrid}>
        <DashboardStatCard
          title="전체 회원 수"
          value="1,247명"
          change="↑ 12% 이번 달 대비"
          changeType="positive"
        />

        <DashboardStatCard
          title="경로 검색 수"
          value="3,892건"
          change="↑ 245건 오늘"
          changeType="positive"
        />

        <DashboardStatCard
          title="실패한 경로 검색 수"
          value="24건"
          change="↓ 4% 전일 대비"
          changeType="negative"
        />

        <DashboardStatCard
          title="데이터 최신 갱신 일자"
          value="2026.08.25"
          change="정기 업데이트 완료"
          changeType="positive"
        />
      </section>

      <div className={styles.dataStatusRow}>
        <div className={styles.dataStatus}>
          <span className={styles.statusDot} />
          <span>TAAS 사고 데이터 최신일</span>
          <strong>2026.08.20</strong>
        </div>

        <div className={styles.dataStatus}>
          <span className={styles.statusDot} />
          <span>표준노드링크 최신일</span>
          <strong>2026.08.22</strong>
        </div>
      </div>

      <section className={styles.chartCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              {currentPeriod.title}
            </h2>

            <p className={styles.sectionDescription}>
              {currentPeriod.description}
            </p>
          </div>

          <div className={styles.periodTabs}>
            <button
              className={
                period === "daily" 
                ? styles.activeTab 
                : styles.periodTab
            }
            onClick={() => setPeriod("daily")}
            aria-pressed={period === "daily"}  
            >
              일간
            </button>

            <button
              className={
                period === "monthly" 
                ? styles.activeTab 
                : styles.periodTab
              }
              onClick={() => setPeriod("monthly")}
              aria-pressed={period === "monthly"}  
            >
              월간
            </button>

            <button
              className={
                period === "yearly" 
                ? styles.activeTab 
                : styles.periodTab
              }
              onClick={() => setPeriod("yearly")}
              aria-pressed={period === "yearly"}  
            >
              연간
            </button>
          </div>
        </div>

        <div className={styles.chartArea}>
          <DashboardUsageChart data={chartData} />
        </div>
      </section>
    </div>
  );
}

export default DashboardPage