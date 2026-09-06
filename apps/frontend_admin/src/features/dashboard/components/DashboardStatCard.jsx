import styles from "./DashboardStatCard.module.css"

function DashboardStatCard({
  title,
  value,
  change,
  changeType = "default",
}) {
  return (
    <article className={styles.card}>
      <p className={styles.title}>{title}</p>

      <strong className={styles.value}>{value}</strong>

      {change && (
        <p className={`${styles.change} ${styles[changeType]}`}>
          {change}
        </p>
      )}
    </article>
  );
}

export default DashboardStatCard