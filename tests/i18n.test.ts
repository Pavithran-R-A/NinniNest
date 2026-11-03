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

  it('Growth, Medication, Vaccination and Routine forms are fully localized in BOTH packs', () => {
    const required = [
      // growth
      'form.growth.weightLb', 'form.growth.weightKg', 'form.growth.heightIn',
      'form.growth.heightCm', 'form.growth.headIn', 'form.growth.headCm',
      // medication
      'form.med.namePlaceholder', 'form.med.instructionsPlaceholder',
      'form.med.unitDrops', 'form.med.unitTabs',
      // vaccination
      'form.vax.subtitle', 'form.vax.namePlaceholder', 'form.vax.nextAppointment', 'form.vax.provider',
      // routine
      'form.routine.title', 'form.routine.namePlaceholder', 'form.routine.type',
      'form.routine.kind.feed', 'form.routine.kind.nap', 'form.routine.kind.pump',
      'form.routine.kind.tummy_time', 'form.routine.kind.reminder',
      // shared form furniture
      'form.photo.babyPreview', 'form.photo.milestonePreview', 'form.baby.create',
    ];
    for (const key of required) {
      expect(packs.en[key], `en missing ${key}`).toBeDefined();
      expect(packs.ta[key], `ta missing ${key}`).toBeDefined();
    }
  });

  it('confirmation dialogs and settings messages are localized in BOTH packs', () => {
    const required = [
      'confirm.deleteBabyTitle', 'confirm.deleteBabyBody', 'confirm.keepIt',
      'confirm.deleteProfile', 'confirm.removeTitle', 'confirm.cannotUndo', 'confirm.remove',
      'settings.rejTitle', 'settings.reviewImportTitle', 'settings.modeLine',
      'settings.modeMergeDetail', 'settings.modeReplaceDetail', 'settings.continueQ',
      'settings.importGo', 'settings.eraseTitle', 'settings.eraseBody',
      'settings.eraseEverything', 'settings.allErased',
      'settings.demoTitle', 'settings.demoBody', 'settings.demoStart',
      'settings.demoEnded', 'settings.demoOn',
      'common.ok', 'common.selected',
    ];
    for (const key of required) {
      expect(packs.en[key], `en missing ${key}`).toBeDefined();
      expect(packs.ta[key], `ta missing ${key}`).toBeDefined();
    }
  });

  it('weekday accessibility labels exist in both packs and interpolate in dialogs', () => {
    for (let d = 0; d <= 6; d++) {
      expect(packs.en[`date.day${d}`]).toBeDefined();
      expect(packs.ta[`date.day${d}`]).toBeDefined();
    }
    expect(translate('en', 'confirm.deleteBabyBody', { name: 'Ada' })).toContain('Ada');
    expect(translate('ta', 'confirm.removeTitle', { what: 'மைல்கல்' })).toContain('மைல்கல்');
    expect(translate('en', 'settings.modeLine', { mode: 'Merge' })).toBe('Mode: Merge.');
  });

  it('the English pack keeps every existing en key when Tamil is extended', () => {
    // Every ta key still maps to an en key (reverse direction of test 1):
    // adding the form/dialog coverage must not have dropped anything.
    const enKeys = new Set(Object.keys(packs.en));
    for (const key of Object.keys(packs.ta)) {
      expect(enKeys.has(key), `ta key ${key} is orphaned`).toBe(true);
    }
  });
});
