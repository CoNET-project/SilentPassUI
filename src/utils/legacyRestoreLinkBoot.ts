// Imported first by index.tsx so the Recovery Code leaves the URL before any
// other module reads, copies or requests it.
import { captureLegacyRestoreLink } from './secretUrlParams'

captureLegacyRestoreLink()
