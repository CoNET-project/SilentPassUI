import React, { forwardRef, useImperativeHandle } from "react"
import BusinessIdentityForm, { type BusinessIdentitySuccess } from "./BusinessIdentityForm"

export type CreateUsernamePinScreenRef = { goBack: () => boolean }

/** Legacy modal entry: same UI as home identity form, with card header inside. */
const CreateUsernamePinScreen = forwardRef<
	CreateUsernamePinScreenRef,
	{
		close: (val: BusinessIdentitySuccess) => void
		isRedeemFlow?: boolean
	}
>(function CreateUsernamePinScreen({ close, isRedeemFlow = false }, ref) {
	useImperativeHandle(
		ref,
		() => ({
			goBack: () => false,
		}),
		[]
	)
	return (
		<div className="flex flex-col h-full min-h-0 bg-white overflow-y-auto">
			<div className="flex-1 px-6 pt-4 pb-6 max-w-md mx-auto w-full">
				<div className="p-6 sm:p-8 rounded-2xl shadow-[0_12px_40px_rgba(0,81,209,0.04)] border border-[#d9dde0]/25 bg-white/95 backdrop-blur-xl">
					<BusinessIdentityForm onSuccess={close} isRedeemFlow={isRedeemFlow} showIntroHeader />
				</div>
			</div>
		</div>
	)
})

export default CreateUsernamePinScreen
