import React from "react";
import SearchInputWithDropdown from './SearchBarWithResults'
import { ChevronLeft } from 'lucide-react'

type Props = {
	close: (path: string|searchResult) => void
}

export default function BeamioSearch({close}: Props) {

return (
	<div className="mt-0 flex items-center px-6 pt-4 pb-3 border-slate-100">
		<main className="flex-1">
		<section className="relative">


			{/* SearchInput 占满整行 */}
			
			<SearchInputWithDropdown
				readonly={false}
				showHistory={true}
				close={path => {
					if (path) close(path)
					else close('/')
				}}
			/>
			
		</section>
		</main>
	</div>
)}
