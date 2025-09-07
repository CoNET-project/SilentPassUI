import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./content.module.scss";


export default function Private() {
	const [selected, setSelected] = useState(false);


	return (
		<div className={styles.Private}>
			<div className={styles.centerWrapper}>
				<motion.div
					onClick={() => setSelected(!selected)}
					initial={false}
					animate={{
					scale: selected ? 1.05 : 1,
					boxShadow: selected ? styles.glow : "none",
				}}
				transition={{ type: "spring", stiffness: 300, damping: 20 }}
				className={`${styles.card} ${selected ? styles.selected : styles.unselectedTransparent}`}
				>
					<AnimatePresence mode="wait">
						<motion.span
							key={selected ? "privacy" : "speed"}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className={styles.label}
						>
							{selected ? "Privacy First" : "Speed First"}
						</motion.span>
					</AnimatePresence>
				</motion.div>
			</div>
</div>
	);
}