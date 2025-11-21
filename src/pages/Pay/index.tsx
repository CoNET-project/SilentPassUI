import Check from './Check'
import ScanBtn from '@/components/Wallet/scanBtn/ScanButtonForB'
import styles from '@/pages/Send/send.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
const Pay = ({}) => {
	const { darkModle, setDarkModle, setProfiles } = useDaemonContext()
    return (
        <div className={styles.home}>
			<div className="px-5 pt-6 flex flex-col gap-2">
				<button
					type="button"
							className={styles.headerBtn}
							aria-label="Toggle theme"
							onClick={() => setDarkModle(!darkModle)}
					>
						<span className={styles.headerBtnIcon}>
							{darkModle ? <LightDrakMode /> : <LightDrakModeBlue />}
						</span>
					</button>
			</div>
			<div className="px-5 pt-6 flex flex-col gap-2">
				<Check />
			</div>
            
        </div>
    )
};

export default Pay
