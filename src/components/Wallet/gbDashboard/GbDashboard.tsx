import styles from './gbDashboard.module.scss';
import { useDaemonContext } from '@/providers/DaemonProvider';

/** Placeholder until cumulative VPN usage can be read from native / API. */
const VPN_USAGE_PLACEHOLDER = '—';

const GbDashboard = () => {
	const { profiles } = useDaemonContext();
	const raw = profiles?.[0]?.tokens?.sGB?.balance;
	const balance =
		raw === undefined || raw === null || raw === ''
			? '0.0000'
			: String(raw);

	return (
		<section className={styles.dashboard} aria-label="Wallet dashboard">
			<div className={styles.eyebrow}>Wallet</div>
			<div className={styles.metrics}>
				<div className={styles.metric}>
					<div className={styles.label}>GB Balance</div>
					<div className={styles.amountRow}>
						<span className={styles.amount}>{balance}</span>
						<span className={styles.unit}>GB</span>
					</div>
				</div>
				<div className={`${styles.metric} ${styles.metricRight}`}>
					<div className={styles.label}>VPN Used</div>
					<div className={styles.amountRow}>
						<span className={`${styles.amount} ${styles.amountPlaceholder}`}>
							{VPN_USAGE_PLACEHOLDER}
						</span>
						<span className={styles.unit}>GB</span>
					</div>
				</div>
			</div>
			<div className={styles.meta}>CoNET DePIN</div>
		</section>
	);
};

export default GbDashboard;
