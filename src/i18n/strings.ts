// Minimal typed i18n with en + ta string packs. Components get t() from AppProvider.
// Fallback: missing Tamil keys render the English string, and missing English keys
// render the key itself (visible in review rather than silently blank).
export type Locale = 'en' | 'ta';
export type ClockFormat = '12h' | '24h';

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
];

type Dict = Record<string, string>;

const en: Dict = {
  'nav.today': 'Today',
  'nav.journal': 'Journal',
  'nav.handoff': 'Handoff',
  'nav.family': 'Family',
  'nav.insights': 'Insights',
  'nav.settings': 'Settings',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.loading': 'Loading…',
  'common.saved': 'Saved to the journal',
  'common.error': 'Could not save — please try again',
  'common.paused': 'paused',
  'common.justNow': 'just now',
  'common.minAgo': '{n} min ago',
  'common.hoursAgo': '{n}h ago',
  'common.daysAgo': '{n}d ago',

  'onb.title1': 'A quiet place for',
  'onb.title2': 'the small hours',
  'onb.subtitle':
    'No account. No cloud. Everything stays on this device until you choose to share it.',
  'onb.nickname': 'Nickname',
  'onb.nicknamePlaceholder': 'What do you call them?',
  'onb.birth': 'Date of birth',
  'onb.birthPlaceholder': 'YYYY-MM-DD',
  'onb.begin': 'Begin the journal',
  'onb.saving': 'Saving…',
  'onb.errName': 'Please give your baby a nickname.',
  'onb.errDate': 'Enter the birth date as YYYY-MM-DD (for example 2026-08-14).',
  'onb.errSave': 'Could not save. Please try again — nothing was written yet.',

  'today.greeting.dawn': 'Still awake',
  'today.greeting.morning': 'Good morning',
  'today.greeting.afternoon': 'Good afternoon',
  'today.greeting.evening': 'Good evening',
  'today.demoTag': 'demo data',
  'today.lastFeed': 'Last feed',
  'today.lastDiaper': 'Last diaper',
  'today.lastSleep': 'Last sleep',
  'today.nothingRecorded': 'nothing recorded',
  'today.quickLog': 'QUICK LOG',
  'today.diaper': 'Diaper',
  'today.bottle': 'Bottle',
  'today.left': 'Left',
  'today.right': 'Right',
  'today.sleep': 'Sleep',
  'today.pump': 'Pump',
  'today.solids': 'Solids',
  'today.note': 'Note',
  'today.logPastSleep': 'Log past sleep',
  'today.logPastTummy': 'Log past tummy time',
  'today.timerStarted': '{kind} timer started',
  'today.timerStartedSide': '{kind} timer started ({side})',
  'today.couldNotStart': 'Could not start the timer',
  'today.pausedToast': 'Paused',
  'today.resumedToast': 'Running again',
  'today.switchedTo': 'Switched to {side}',
  'today.couldNotSwitch': 'Could not switch sides',
  'today.pumpSaved': 'Pumping session saved',
  'today.couldNotSave': 'Could not save',
  'today.noBaby.title': 'No baby profile yet',
  'today.noBaby.body': 'Create a profile to start recording care events.',
  'today.repeatLast': 'Repeat last',

  'journal.title': 'Journal',
  'journal.subtitle': '{name} · full history',
  'journal.empty.title': 'Nothing recorded yet',
  'journal.empty.body': 'Your journal fills in as you log care events on the Today screen.',
  'journal.demoTag': 'Demo data — not your records',

  'handoff.title': 'Care handoff',
  'handoff.subtitle':
    'A precise letter for the next caregiver — built only from what was actually recorded.',
  'handoff.window12': 'Last 12 hours',
  'handoff.window24': 'Last 24 hours',
  'handoff.copy': 'Copy letter',
  'handoff.copied': 'Copied',
  'handoff.share': 'Share…',
  'handoff.privacy':
    'This letter contains private care information. Share only with trusted caregivers.',
  'handoff.empty': 'Nothing recorded in this window. Entries appear here the moment they are logged.',
  'handoff.noBaby.title': 'No baby profile',
  'handoff.noBaby.body': 'Create a profile first to build a handoff.',
  'handoff.recordedWith': 'Recorded with NinniNest.',

  'family.title': 'Family',
  'family.tab.profiles': 'Profiles',
  'family.tab.growth': 'Growth',
  'family.tab.milestones': 'Milestones',
  'family.tab.health': 'Health',
  'family.tab.routines': 'Routines',
  'family.noBaby.title': 'No profiles yet',
  'family.noBaby.body': 'Create a profile for each child — twins and siblings each get their own journal, timers and history.',
  'family.addBaby': 'Add a baby',
  'family.growthEmpty.title': 'No growth records yet',
  'family.growthEmpty.body': 'Weigh-ins and measurements appear here. Percentiles are intentionally not calculated.',
  'family.milestonesEmpty.title': 'No milestones yet',
  'family.milestonesEmpty.body': 'First smiles, first rolls — record them as they happen.',
  'family.healthEmpty.title': 'No health records yet',
  'family.healthEmpty.body': 'Medication doses and vaccinations you record appear here. The app never suggests doses.',
  'family.routinesEmpty.title': 'No routines yet',
  'family.routinesEmpty.body': 'Weekly rhythm templates with gentle reminders.',
  'family.routineReminderNote': 'Reminders are informational only — they never create records.',
  'settings.title': 'Settings',
  'settings.section.appearance': 'Appearance',
  'settings.section.language': 'Language & time',
  'settings.section.data': 'Your data',
  'settings.section.demo': 'Demo mode',
  'settings.section.about': 'About',
  'settings.nightMode': 'Night mode',
  'settings.nightModeDetail': 'Warm, dim, and fully legible for 3 AM feeds.',
  'settings.language': 'App language',
  'settings.languageDetail': 'English and Tamil are available now.',
  'settings.clock': 'Time display',
  'settings.clock12': '12-hour',
  'settings.clock24': '24-hour',
  'settings.exportJson': 'Export backup (JSON)',
  'settings.exportCsv': 'Export care history (CSV)',
  'settings.import': 'Import a backup',
  'settings.importMode': 'When importing:',
  'settings.importModeMerge': 'Merge',
  'settings.importModeReplace': 'Replace all',
  'settings.importModeHint':
    'Merge adds new records and keeps everything you have. Replace erases current records first. Either way the file is fully checked before anything changes.',
  'settings.erase': 'Erase all data',
  'settings.tryDemo': 'Try demo mode',
  'settings.exitDemo': 'Exit demo mode',
  'settings.about':
    'A local-first care journal. Core tracking, history, export and erase are free forever. There is no account, no advertising and no hidden subscription.',
};

// Tamil pack. Coverage: navigation, common actions, onboarding, Today, Journal,
// Handoff, Settings. Untranslated keys fall back to English at runtime — this is a
// documented limitation, not silent breakage. Clinical terms are kept plain and
// neutral; nothing is phrased as medical advice in either language.
const ta: Dict = {
  'nav.today': 'இன்று',
  'nav.journal': 'நாட்குறிப்பு',
  'nav.handoff': 'கையளிப்பு',
  'nav.family': 'குடும்பம்',
  'nav.insights': 'நோக்குவரைவு',
  'nav.settings': 'அமைப்புகள்',

  'common.save': 'சேமி',
  'common.cancel': 'ரத்து',
  'common.delete': 'நீக்கு',
  'common.edit': 'திருத்து',
  'common.close': 'மூடு',
  'common.done': 'முடிந்தது',
  'common.loading': 'ஏற்றுகிறது…',
  'common.saved': 'நாட்குறிப்பில் சேமிக்கப்பட்டது',
  'common.error': 'சேமிக்க முடியவில்லை — மீண்டும் முயற்சிக்கவும்',
  'common.paused': 'இடைநிறுத்தப்பட்டது',
  'common.justNow': 'இப்போது',
  'common.minAgo': '{n} நிமிடம் முன்பு',
  'common.hoursAgo': '{n} மணி நேரம் முன்பு',
  'common.daysAgo': '{n} நாட்கள் முன்பு',

  'onb.title1': 'சிறு நேரங்களுக்கான',
  'onb.title2': 'அமைதியான இடம்',
  'onb.subtitle': 'கணக்கு இல்லை. மேகம் இல்லை. நீங்கள் பங்கிடும் வரை அனைத்தும் இந்தச் சாதனத்திலேயே இருக்கும்.',
  'onb.nickname': 'அழைப்புப்பெயர்',
  'onb.nicknamePlaceholder': 'எப்படி அழைக்கிறீர்கள்?',
  'onb.birth': 'பிறந்த நாள்',
  'onb.birthPlaceholder': 'YYYY-MM-DD',
  'onb.begin': 'நாட்குறிப்பைத் தொடங்கு',
  'onb.saving': 'சேமிக்கிறது…',
  'onb.errName': 'குழந்தைக்கு ஒரு அழைப்புப்பெயர் கொடுங்கள்.',
  'onb.errDate': 'பிறந்த நாளை YYYY-MM-DD என உள்ளிடுங்கள் (எ.கா. 2026-08-14).',
  'onb.errSave': 'சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும் — இன்னும் எதுவும் எழுதப்படவில்லை.',

  'today.greeting.dawn': 'இன்னும் விழித்திருக்கிறீர்கள்',
  'today.greeting.morning': 'காலை வணக்கம்',
  'today.greeting.afternoon': 'மதிய வணக்கம்',
  'today.greeting.evening': 'மாலை வணக்கம்',
  'today.demoTag': 'மாதிரி தரவு',
  'today.lastFeed': 'கடைசி ஊட்டல்',
  'today.lastDiaper': 'கடைசி டயப்பர்',
  'today.lastSleep': 'கடைசி தூக்கம்',
  'today.nothingRecorded': 'எதுவும் பதிவில்லை',
  'today.quickLog': 'விரைவுப் பதிவு',
  'today.diaper': 'டயப்பர்',
  'today.bottle': 'பாட்டில்',
  'today.left': 'இடது',
  'today.right': 'வலது',
  'today.sleep': 'தூக்கம்',
  'today.pump': 'பம்ப்',
  'today.solids': 'திட உணவு',
  'today.note': 'குறிப்பு',
  'today.logPastSleep': 'கடந்த தூக்கத்தைப் பதிவு செய்',
  'today.logPastTummy': 'கடந்த வயிற்றுப் பயிற்சியைப் பதிவு செய்',
  'today.couldNotStart': 'டைமரைத் தொடங்க முடியவில்லை',
  'today.pausedToast': 'இடைநிறுத்தப்பட்டது',
  'today.resumedToast': 'மீண்டும் இயங்குகிறது',
  'today.switchedTo': '{side} பக்கம் மாறியது',
  'today.couldNotSwitch': 'பக்கம் மாற்ற முடியவில்லை',
  'today.pumpSaved': 'பம்ப் அமர்வு சேமிக்கப்பட்டது',
  'today.couldNotSave': 'சேமிக்க முடியவில்லை',
  'today.noBaby.title': 'இன்னும் குழந்தை சுயவிவரம் இல்லை',
  'today.noBaby.body': 'பதிவுகளைத் தொடங்க சுயவிவரம் உருவாக்குங்கள்.',
  'today.repeatLast': 'கடைசியை மீண்டும்',

  'journal.title': 'நாட்குறிப்பு',
  'journal.subtitle': '{name} · முழு வரலாறு',
  'journal.empty.title': 'இன்னும் எதுவும் பதிவில்லை',
  'journal.empty.body': 'இன்று திரையில் பதிவு செய்தால் நாட்குறிப்பு நிரம்பும்.',
  'journal.demoTag': 'மாதிரி தரவு — உங்கள் பதிவுகள் அல்ல',

  'handoff.title': 'கவனிப்புக் கையளிப்பு',
  'handoff.subtitle': 'அடுத்த கவனிப்பாளருக்கான கடிதம் — பதிவு செய்யப்பட்டவற்றிலிருந்து மட்டுமே.',
  'handoff.window12': 'கடந்த 12 மணி நேரம்',
  'handoff.window24': 'கடந்த 24 மணி நேரம்',
  'handoff.copy': 'கடிதத்தை நகலெடு',
  'handoff.copied': 'நகலெடுக்கப்பட்டது',
  'handoff.share': 'பங்கிடு…',
  'handoff.privacy': 'இந்தக் கடிதம் தனிப்பட்ட கவனிப்புத் தகவல். நம்பிக்கையான கவனிப்பாளருடன் மட்டும் பங்கிடுங்கள்.',
  'handoff.empty': 'இந்த நேர இடைவெளியில் எதுவும் பதிவில்லை. பதிவு செய்தவுடன் இங்கே தோன்றும்.',
  'handoff.noBaby.title': 'குழந்தை சுயவிவரம் இல்லை',
  'handoff.noBaby.body': 'முதலில் சுயவிவரம் உருவாக்குங்கள்.',
  'handoff.recordedWith': 'NinniNest-இல் பதிவு செய்யப்பட்டது.',

  'settings.title': 'அமைப்புகள்',
  'settings.section.appearance': 'தோற்றம்',
  'settings.section.language': 'மொழி மற்றும் நேரம்',
  'settings.section.data': 'உங்கள் தரவு',
  'settings.section.demo': 'மாதிரி முறை',
  'settings.section.about': 'பற்றி',
  'settings.nightMode': 'இரவு முறை',
  'settings.nightModeDetail': 'காலை 3 மணி ஊட்டலுக்கு ஏற்ற மங்கலான வெப்ப ஒளி.',
  'settings.language': 'செயலி மொழி',
  'settings.languageDetail': 'ஆங்கிலம் மற்றும் தமிழ் இப்போது கிடைக்கின்றன.',
  'settings.clock': 'நேரக் காட்சி',
  'settings.clock12': '12 மணி',
  'settings.clock24': '24 மணி',
  'settings.exportJson': 'காப்பகத்தை ஏற்றுமதி (JSON)',
  'settings.exportCsv': 'கவனிப்பு வரலாற்றை ஏற்றுமதி (CSV)',
  'settings.import': 'காப்பகத்தை இறக்குமதி',
  'settings.importMode': 'இறக்குமதியின் போது:',
  'settings.importModeMerge': 'இணை',
  'settings.importModeReplace': 'எல்லாம் மாற்று',
  'settings.importModeHint':
    'இணைப்பு புதிய பதிவுகளைச் சேர்க்கும், ஏற்கனவே உள்ளவை அப்படியே இருக்கும். மாற்று முதலில் தற்போதைய பதிவுகளை அழிக்கும். எந்த முறையிலும் கோப்பு முழுமையாகச் சரிபார்க்கப்பட்ட பிறகே மாற்றங்கள் நடக்கும்.',
  'settings.erase': 'அனைத்தையும் அழி',
  'settings.tryDemo': 'மாதிரி முறையை முயற்சி',
  'settings.exitDemo': 'மாதிரி முறையை விட்டு வெளியேறு',
  'settings.about':
    'உள்ளூர்-முதன்மை கவனிப்பு நாட்குறிப்பு. அடிப்படைப் பதிவு, வரலாறு, ஏற்றுமதி, அழிப்பு — என்றென்றும் இலவசம். கணக்கு இல்லை, விளம்பரம் இல்லை, மறைந்த சந்தா இல்லை.',
};

export const packs: Record<Locale, Dict> = { en, ta };

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const pack = packs[locale] ?? packs.en;
  let s = pack[key] ?? packs.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export type TFunc = (key: string, params?: Record<string, string | number>) => string;

export function makeT(locale: Locale): TFunc {
  return (key, params) => translate(locale, key, params);
}
