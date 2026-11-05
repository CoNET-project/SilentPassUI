import { VoicePlayoutLead } from './voicePlayoutLead'

describe('VoicePlayoutLead', () => {
	it('starts at 120 ms', () => {
		expect(new VoicePlayoutLead().sec).toBeCloseTo(0.12)
	})

	it('grows 80 ms per underrun up to 600 ms', () => {
		const lead = new VoicePlayoutLead()
		lead.noteUnderrun(0)
		expect(lead.sec).toBeCloseTo(0.2)
		for (let i = 1; i < 20; i += 1) lead.noteUnderrun(i)
		expect(lead.sec).toBeCloseTo(0.6)
		expect(lead.underruns).toBe(20)
	})

	it('decays 20 ms once per 10 s without an underrun, never below the start', () => {
		const lead = new VoicePlayoutLead()
		lead.noteUnderrun(1_000)
		lead.maybeDecay(10_999)
		expect(lead.sec).toBeCloseTo(0.2)
		lead.maybeDecay(11_000)
		expect(lead.sec).toBeCloseTo(0.18)
		lead.maybeDecay(15_000)
		expect(lead.sec).toBeCloseTo(0.18)
		for (let t = 21_000; t < 200_000; t += 10_000) lead.maybeDecay(t)
		expect(lead.sec).toBeCloseTo(0.12)
	})

	it('reset returns to the start', () => {
		const lead = new VoicePlayoutLead()
		lead.noteUnderrun(0)
		lead.reset()
		expect(lead.sec).toBeCloseTo(0.12)
		expect(lead.underruns).toBe(0)
	})
})
