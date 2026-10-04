/*
 * Browser tests (Vitest's browser mode on Chromium): the real CSS, fonts and English catalogue, so
 * direction, isolation and layout are measured as a user would see them.
 */
import '@testing-library/jest-dom/vitest'
import '../index.css'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { activateLanguage } from '../i18n/activate'
import { englishMessages } from '../i18n/catalogues'
import { ENGLISH } from '../i18n/languages'

// Findings and waits allow 5 s, not Testing Library's 1 s: a busy CI runner misses 1 s (#245).
configure({ asyncUtilTimeout: 5000 })

activateLanguage(ENGLISH, englishMessages())

afterEach(() => {
  cleanup()
})
