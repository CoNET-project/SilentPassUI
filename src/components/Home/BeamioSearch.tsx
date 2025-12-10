import React from "react";
import SearchInputWithDropdown, {searchResult} from './SearchBarWithResults'

type Props = {
	close: (path: string) => void
}

export default function BeamioSearch({close}: Props) {
	return (
		<div className="mt-4 flex items-center justify-between px-6 pt-4 pb-3 border-slate-100">

		{/* Content */}
			<main className="flex-1">
				{/* Intro card */}
				<section className="">
					<SearchInputWithDropdown readonly={false} close={path => {
						close(path)
					}}
					/>
				</section>
			</main>
		</div>
	);
}
