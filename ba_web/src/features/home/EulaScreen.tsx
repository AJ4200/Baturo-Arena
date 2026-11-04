import { AiOutlineFileText } from 'react-icons/ai';

type EulaScreenProps = {
  onBack: () => void;
};

const EULA_UPDATED = 'November 2026';

const EULA_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Acceptance of terms',
    body: [
      'By installing, accessing, or playing Baturo Arena ("the Game") you agree to this End User License Agreement. If you do not agree, do not use the Game.',
    ],
  },
  {
    title: '2. License grant',
    body: [
      'You are granted a personal, non-exclusive, non-transferable, revocable license to use the Game for non-commercial entertainment purposes.',
      'You may not copy, modify, redistribute, sell, sublicense, or reverse engineer the Game except where applicable law allows it.',
    ],
  },
  {
    title: '3. Accounts and profiles',
    body: [
      'You can play as a guest or sign in with Google. Online multiplayer, chat, and leaderboards require a signed-in account.',
      'You are responsible for the name you choose and for activity under your profile. Names and messages must not be offensive, hateful, or impersonate others.',
    ],
  },
  {
    title: '4. Data and storage',
    body: [
      'The Game stores settings, your player name and ID, match history, and local backups in your browser storage. Google sign-in may use Google-managed cookies during authentication. Baturo Arena does not set advertising or tracking cookies.',
      'When you play online, your display name, profile avatar, room activity, chat messages, and match results are sent to our servers so the multiplayer features can work.',
    ],
  },
  {
    title: '5. Acceptable use',
    body: [
      'Do not cheat, exploit bugs, automate play, disrupt servers, harass other players, or attempt to access data that is not yours. We may remove content or restrict access for violations.',
    ],
  },
  {
    title: '6. Ownership',
    body: [
      'The Game, its code, art, music, and branding belong to AJ4200 and its licensors. Third-party assets remain the property of their respective owners.',
    ],
  },
  {
    title: '7. Availability and changes',
    body: [
      'The Game is an early version provided "as is". Features, rooms, and saved data may change, reset, or be removed at any time without notice.',
      'We may update this agreement as the Game evolves. Continued use after an update means you accept the new terms.',
    ],
  },
  {
    title: '8. Disclaimer and liability',
    body: [
      'To the maximum extent permitted by law, the Game is provided without warranties of any kind, and AJ4200 is not liable for any loss or damages arising from its use.',
    ],
  },
  {
    title: '9. Contact',
    body: ['Questions about this agreement can be sent to AJ4200 through the GitHub or LinkedIn links in the site footer.'],
  },
];

export function EulaScreen({ onBack }: EulaScreenProps) {
  return (
    <section className="title-screen-content history-screen eula-screen">
      <div className="history-screen-heading">
        <h1>
          <span>EU-</span>
          <span>LA</span>
        </h1>
      </div>

      <div className="history-archive eula-archive">
        <div className="history-toolbar">
          <button className="history-back-button" type="button" onClick={onBack}>
            <AiOutlineFileText aria-hidden="true" /> Back to Menu
          </button>
        </div>

        <article className="eula-document">
          <header className="eula-document-head">
            <span className="eula-document-icon" aria-hidden="true">
              <AiOutlineFileText />
            </span>
            <div>
              <strong>Baturo Arena End User License Agreement</strong>
              <span>Early version · Last updated {EULA_UPDATED}</span>
            </div>
          </header>

          {EULA_SECTIONS.map((section) => (
            <section key={section.title} className="eula-section">
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </section>
  );
}
