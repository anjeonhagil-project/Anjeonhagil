import styles from "./DashboardUsageChart.module.css"

function DashboardUsageChart({ data }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className={styles.chart}>
      {data.map((item) => {
        const height = (item.value / maxValue) * 100;

        return (
          <div
            className={styles.barItem}
            key={item.label}
          >
            <div className={styles.barArea}>
              <div
                className={`${styles.bar} ${
                  item.highlight ? styles.highlight : ""
                }`}
                style={{ height: `${height}%` }}
                title={`${item.label}: ${item.value}건`}
              />
            </div>

            <span className={styles.label}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default DashboardUsageChart