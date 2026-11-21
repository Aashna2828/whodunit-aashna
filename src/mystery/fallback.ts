import type { Mystery } from './types'

// Used when the AI fails validation 3 times in a row, so a game always starts.
// A test checks that this mystery passes the same validator as AI output.
export const FALLBACK_MYSTERY: Mystery = {
  title: 'The Last Train to Halden',
  setting: 'A night train crossing the mountains in a snowstorm, 1932.',
  victim: 'Lord Cyril Ashby, found slumped over his evening tea in the dining car.',
  suspects: [
    { name: 'Iris Vane', role: 'the conductor', description: 'Brisk, tired, and short on patience.' },
    { name: 'Dr. Otto Kemp', role: 'a physician', description: 'Travelling to a conference, rarely without his bag.' },
    { name: 'Mabel Rook', role: 'the dining car chef', description: 'Has cooked on this line for twenty years.' },
    { name: 'Felix Arden', role: "the victim's nephew", description: 'Charming, broke, and set to inherit.' },
  ],
  culprit: 'Mabel Rook',
  explanation:
    'Lord Ashby planned to shut down the dining service, ending Mabel’s job. She alone prepared and carried his tea, and the poison was hidden in her apron.',
  clues: [
    { suspect: 'Iris Vane', kind: 'clears', text: 'The ticket log shows Iris punching tickets in car 6 the whole time tea was served.' },
    { suspect: 'Iris Vane', kind: 'incriminates', text: 'Iris argued loudly with Lord Ashby about his ticket earlier that evening.' },
    { suspect: 'Dr. Otto Kemp', kind: 'clears', text: 'A porter heard Dr. Kemp snoring in his sleeper berth when the tea was poured.' },
    { suspect: 'Dr. Otto Kemp', kind: 'incriminates', text: 'Dr. Kemp’s bag contains several bottles of sedatives.' },
    { suspect: 'Felix Arden', kind: 'clears', text: 'Three passengers swear Felix was playing cards in the lounge car all evening.' },
    { suspect: 'Felix Arden', kind: 'incriminates', text: 'Felix inherits the Ashby estate.' },
    { suspect: 'Mabel Rook', kind: 'incriminates', text: 'An empty poison vial was found wrapped in a dining car apron.' },
    { suspect: 'Mabel Rook', kind: 'incriminates', text: 'Only the chef prepared and carried Lord Ashby’s tea tray.' },
    { suspect: 'Mabel Rook', kind: 'incriminates', text: 'Lord Ashby had written to the railway asking them to close the dining service.' },
    { suspect: 'Iris Vane', kind: 'clears', text: 'Iris has no key to the dining car pantry.' },
  ],
}
