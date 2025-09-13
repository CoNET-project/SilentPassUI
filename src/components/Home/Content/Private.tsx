import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./content.module.scss";
import { useDaemonContext } from "@/providers/DaemonProvider";
import { useTranslation } from 'react-i18next';

export default function Private() {
	const { t, i18n } = useTranslation();
	const { privacyMode, setPrivacyMode } = useDaemonContext();

	return (
		<div className={styles.Private}>
			<div className={styles.centerWrapper}>
				<motion.div
					onClick={() => setPrivacyMode(!privacyMode)}
					initial={false}
					animate={{
					scale: privacyMode ? 1.05 : 1,
					boxShadow: privacyMode ? styles.glow : "none",
				}}
				transition={{ type: "spring", stiffness: 300, damping: 20 }}
				className={`${styles.card} ${privacyMode ? styles.selected : styles.unselectedTransparent}`}
				>
					<AnimatePresence mode="wait">
						<motion.span
							key={privacyMode ? "privacy" : "speed"}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className={styles.label}
						>
							{privacyMode ? t("privacy-first") : t("speed-first")}
						</motion.span>
					</AnimatePresence>
				</motion.div>
			</div>
		</div>
	);
}