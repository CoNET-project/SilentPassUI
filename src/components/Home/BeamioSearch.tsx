import React from "react";

// Beamio – "How it works" screen (Alpha)
// Explains the 0.2 USDC test balance and the three MVP flows.
import SearchInputWithDropdown from './SearchBarWithResults'
export default function BeamioSearch() {
	return (
		<div className="mt-4 flex items-center justify-between px-6 pt-4 pb-3 border-slate-100">

		{/* Content */}
			<main className="flex-1">
				{/* Intro card */}
				<section className="">
					<SearchInputWithDropdown onSelect={() => {

					}} />
				</section>
			</main>
		</div>
	);
}
