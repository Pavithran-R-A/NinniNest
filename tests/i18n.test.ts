import { describe, it, expect } from 'vitest';
import { translate, packs, makeT, LOCALES } from '../src/i18n/strings';

describe('i18n', () => {
  it('has English as complete reference pack (all ta keys exist in en)', () => {
    for (const key of Object.keys(packs.ta)) {
      expect(packs.en[key], `ta key ${key} missing from en pack`).toBeDefined();
    }
  });

  it('falls back to English for missing Tamil keys', () => {
    // 'family.tab.profiles' intentionally has no Tamil entry
    expect(translate('ta', 'family.tab.profiles')).toBe(packs.en['family.tab.profiles']);
  });

  it('returns the key itself when missing from both packs', () => {
    expect(translate('en', 'bogus.missing.key')).toBe('bogus.missing.key');
  });

  it('interpolates {params} in both languages', () => {
    expect(translate('en', 'today.switchedTo', { side: 'left' })).toBe('Switched to left');
    expect(translate('ta', 'today.switchedTo', { side: 'இடது' })).toContain('இடது');
    expect(translate('en', 'journal.subtitle', { name: 'Ada' })).toContain('Ada');
  });

  it('replaces all occurrences of a repeated param', () => {
    expect(translate('en', 'common.hoursAgo', { n: 3 })).not.toContain('{n}');
  });

  it('makeT binds the locale once', () => {
    const t = makeT('ta');
    expect(t('nav.today')).toBe('இன்று');
    expect(t('nav.settings')).toBe('அமைப்புகள்');
  });

  it('declares exactly the supported locales (unsupported stay disabled)', () => {
    expect(LOCALES.map((l) => l.code).sort()).toEqual(['en', 'ta']);
  });

  it('Tamil pack covers nav + onboarding + Today + settings sections', () => {
    const required = [
      'nav.today', 'nav.journal', 'nav.handoff', 'nav.family', 'nav.insights', 'nav.settings',
      'onb.title1', 'onb.begin', 'today.greeting.morning', 'today.lastFeed',
      'settings.section.language', 'settings.clock', 'handoff.title',
    ];
    for (const key of required) {
      expect(packs.ta[key], `ta missing ${key}`).toBeDefined();
    }
  });
});
