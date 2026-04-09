"use client";

interface CharacterSheetData {
  name: string;
  race: string;
  subrace?: string | null;
  class: string;
  subclass?: string | null;
  level: number;
  background: string;
  alignment: string;
  appearance: string;
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
  backstory: string;
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  savingThrowProficiencies: string[];
  skillProficiencies: string[];
  hp: number;
  ac: number;
  speed: number;
  initiative: number;
  proficiencyBonus: number;
  equipment: string[];
  features: string[];
  languages: string[];
  toolProficiencies: string[];
  weaponProficiencies: string[];
  armorProficiencies: string[];
  spells?: unknown;
}

interface CharacterSheetProps {
  data: CharacterSheetData;
  onClose: () => void;
}

const ATTR_LABELS: Record<string, string> = {
  strength: "FOR",
  dexterity: "DES",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "SAB",
  charisma: "CAR",
};

const SKILL_MAP: Record<string, string> = {
  Acrobatics: "DES",
  "Animal Handling": "SAB",
  Arcana: "INT",
  Athletics: "FOR",
  Deception: "CAR",
  History: "INT",
  Insight: "SAB",
  Intimidation: "CAR",
  Investigation: "INT",
  Medicine: "SAB",
  Nature: "INT",
  Perception: "SAB",
  Performance: "CAR",
  Persuasion: "CAR",
  Religion: "INT",
  "Sleight of Hand": "DES",
  Stealth: "DES",
  Survival: "SAB",
};

const DEFAULT_ATTRIBUTES: CharacterSheetData["attributes"] = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function StatBox({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 min-w-[64px]">
      <span className="text-amber-400 text-xs font-bold tracking-widest mb-1">{label}</span>
      <span className="text-white text-2xl font-bold leading-none">{score}</span>
      <span className="text-stone-300 text-sm mt-0.5">{modifier(score)}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-amber-400 text-xs font-bold tracking-widest uppercase border-b border-stone-700 pb-1 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Pill({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full border mr-1 mb-1 ${
        highlight
          ? "border-amber-600 text-amber-300 bg-amber-900/30"
          : "border-stone-600 text-stone-300 bg-stone-800"
      }`}
    >
      {text}
    </span>
  );
}

export default function CharacterSheet({ data, onClose }: CharacterSheetProps) {
  const attrs = { ...DEFAULT_ATTRIBUTES, ...(data.attributes ?? {}) };
  const profBonus = data.proficiencyBonus ?? 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="w-full max-w-3xl bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div
          className="relative px-6 py-5 bg-gradient-to-r from-stone-800 to-stone-900 border-b border-stone-700 rounded-t-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-stone-500 hover:text-stone-200 text-xl leading-none"
          >
            ✕
          </button>
          <div className="flex items-end gap-4">
            <div className="text-5xl">🧙</div>
            <div>
              <h1 className="text-amber-200 text-2xl font-bold leading-tight">{data.name}</h1>
              <p className="text-stone-400 text-sm mt-0.5">
                {[data.subrace, data.race].filter(Boolean).join(" ")} ·{" "}
                {[data.class, data.subclass].filter(Boolean).join(" / ")} · Nível {data.level}
              </p>
              <p className="text-stone-500 text-xs mt-0.5">
                {data.background} · {data.alignment}
              </p>
            </div>
          </div>

          {/* Combat stats row */}
          <div className="flex gap-4 mt-4 flex-wrap">
            {[
              { label: "HP", value: data.hp },
              { label: "CA", value: data.ac },
              { label: "Velocidade", value: `${data.speed}ft` },
              { label: "Iniciativa", value: modifier(attrs.dexterity) },
              { label: "Proficiência", value: `+${profBonus}` },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center bg-stone-900/60 border border-stone-700 rounded-lg px-3 py-1.5 min-w-[56px]">
                <span className="text-stone-500 text-xs">{s.label}</span>
                <span className="text-white font-bold text-lg leading-tight">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div>
            {/* Attributes */}
            <Section title="Atributos">
              <div className="flex flex-wrap gap-2">
                {Object.entries(attrs).map(([key, val]) => (
                  <StatBox key={key} label={ATTR_LABELS[key] ?? key.toUpperCase()} score={val} />
                ))}
              </div>
            </Section>

            {/* Saving throws */}
            <Section title="Testes de Resistência">
              <div className="flex flex-wrap">
                {Object.keys(ATTR_LABELS).map((attr) => {
                  const isProficient = data.savingThrowProficiencies?.some(
                    (s) => s.toLowerCase() === attr.toLowerCase()
                  );
                  const attrScore = attrs[attr as keyof typeof attrs] ?? 10;
                  const mod = Math.floor((attrScore - 10) / 2) + (isProficient ? profBonus : 0);
                  return (
                    <div key={attr} className="flex items-center gap-1.5 w-1/2 mb-1.5">
                      <span
                        className={`w-2 h-2 rounded-full border ${
                          isProficient
                            ? "bg-amber-400 border-amber-400"
                            : "bg-transparent border-stone-500"
                        }`}
                      />
                      <span className="text-xs text-stone-300">
                        {mod >= 0 ? `+${mod}` : mod} {ATTR_LABELS[attr]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Skills */}
            <Section title="Perícias">
              <div className="space-y-0.5">
                {Object.entries(SKILL_MAP).map(([skill, attrAbbr]) => {
                  const attrKey = Object.entries(ATTR_LABELS).find(([, v]) => v === attrAbbr)?.[0];
                  const attrScore = attrKey ? (attrs[attrKey as keyof typeof attrs] ?? 10) : 10;
                  const isProficient = data.skillProficiencies?.some(
                    (s) => s.toLowerCase().replace(/\s/g, "") === skill.toLowerCase().replace(/\s/g, "")
                  );
                  const mod = Math.floor((attrScore - 10) / 2) + (isProficient ? profBonus : 0);
                  return (
                    <div key={skill} className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full border flex-shrink-0 ${
                          isProficient ? "bg-amber-400 border-amber-400" : "bg-transparent border-stone-600"
                        }`}
                      />
                      <span className="text-xs text-stone-400 w-5 text-right">{mod >= 0 ? `+${mod}` : mod}</span>
                      <span className={`text-xs ${isProficient ? "text-stone-200" : "text-stone-500"}`}>
                        {skill}
                        <span className="text-stone-600 ml-1">({attrAbbr})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* Right column */}
          <div>
            {/* Appearance & Personality */}
            <Section title="Aparência">
              <p className="text-stone-300 text-sm leading-relaxed">{data.appearance}</p>
            </Section>

            <Section title="Personalidade & Tendências">
              <div className="space-y-2">
                {[
                  { label: "Personalidade", value: data.personality },
                  { label: "Ideais", value: data.ideals },
                  { label: "Vínculos", value: data.bonds },
                  { label: "Falhas", value: data.flaws },
                ].map((item) => (
                  <div key={item.label}>
                    <span className="text-amber-500 text-xs font-semibold">{item.label}: </span>
                    <span className="text-stone-300 text-xs">{item.value}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Equipamento">
              <div className="flex flex-wrap">
                {(data.equipment ?? []).map((item, i) => (
                  <Pill key={i} text={item} />
                ))}
              </div>
            </Section>

            <Section title="Proficiências">
              <div className="space-y-1.5">
                {data.languages?.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Idiomas: </span>
                    {data.languages.map((l, i) => <Pill key={i} text={l} highlight />)}
                  </div>
                )}
                {data.weaponProficiencies?.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Armas: </span>
                    {data.weaponProficiencies.map((l, i) => <Pill key={i} text={l} />)}
                  </div>
                )}
                {data.armorProficiencies?.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Armaduras: </span>
                    {data.armorProficiencies.map((l, i) => <Pill key={i} text={l} />)}
                  </div>
                )}
                {data.toolProficiencies?.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Ferramentas: </span>
                    {data.toolProficiencies.map((l, i) => <Pill key={i} text={l} />)}
                  </div>
                )}
              </div>
            </Section>
          </div>
        </div>

        {/* Full-width sections */}
        <div className="px-6 pb-6">
          <Section title="Características & Habilidades de Classe/Raça">
            <div className="space-y-1.5">
              {(data.features ?? []).map((f, i) => {
                const [name, ...rest] = f.split(":");
                return (
                  <div key={i} className="text-sm">
                    <span className="text-amber-300 font-semibold">{name.trim()}</span>
                    {rest.length > 0 && (
                      <span className="text-stone-400">: {rest.join(":").trim()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Antecedentes & História">
            <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{data.backstory}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
