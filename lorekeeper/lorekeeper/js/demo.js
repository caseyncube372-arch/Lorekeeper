/* ============================================================
   Lorekeeper — demo world
   "Aethermoor": a ready-made universe so new visitors can
   explore every feature before committing to their own lore.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { uid } = LK.util;

  function build() {
    const t = Date.now();

    const E = (type, name, extra = {}) => ({
      id: uid(), type, name,
      summary: '', description: '', tags: [], image: '',
      role: '', age: '', pronouns: '', kind: '', ruler: '', capital: '', founded: '', leader: '',
      createdAt: t, updatedAt: t,
      ...extra,
    });

    /* ----- characters ----- */
    const isolde = E('character', 'Queen Isolde Vael', {
      role: 'Sovereign of the Kingdom of Vael', age: '38', pronouns: 'she/her',
      summary: 'A queen who married the storm to keep her throne.',
      description: 'Isolde was crowned at nineteen, three days after her father\u2019s flagship fell out of the sky. The court expected a regent to rule through her; instead she flew to the Stormborder alone and returned with lightning bound in a ring of glass, which she has worn on her brow ever since.\n\nShe is patient, unreadable, and keeps a second, empty throne beside her own \u2014 for reasons no minister has dared to ask about.',
      tags: ['royalty', 'storm-bonded'],
    });
    const kael = E('character', 'Kael Dustwind', {
      role: 'Captain of the Gale Reckoning', age: '44', pronouns: 'he/him',
      summary: 'Sky-pirate captain with a bounty in three kingdoms and a debt in a fourth.',
      description: 'Kael has been ejected from more airships than most people have boarded. He captains the Gale Reckoning, a salvage-frigate held together by spite and good ropework, and he claims to have sailed the underside of the Spire.\n\nHe knows the Stormborder Anomaly better than any admiral \u2014 because he caused part of it.',
      tags: ['sky-pirate', 'exile'],
    });
    const mirren = E('character', 'Archivist Mirren', {
      role: 'First Voice of the Order of the Silent Page', age: '107 (disputed)', pronouns: 'she/her',
      summary: 'Keeper of the Spire archives, who remembers things that have not happened yet.',
      description: 'Mirren\u2019s order vows silence in the archives and speech everywhere else. She has catalogued every recorded event since the Sundering, including several that the historical record does not yet contain.\n\nShe and Queen Isolde meet four times a year. No minutes are kept.',
      tags: ['order-of-the-silent-page', 'scholar'],
    });
    const thorn = E('character', 'Thorn', {
      role: 'Blade of the Cinder Syndicate', age: 'unknown', pronouns: 'they/them',
      summary: 'An assassin who walks through smoke and arrives already inside.',
      description: 'Thorn\u2019s contracts are written on cigarette paper and burned upon completion. They sabotaged the ninth anchor-chain during the Night of Long Shadows \u2014 or so the bounty notice claims, and the bounty notice was written by Thorn.',
      tags: ['assassin', 'cinder-syndicate'],
    });
    const aldric = E('character', 'Prince Aldric Vael', {
      role: 'Exiled heir of Vaelhold', age: '19', pronouns: 'he/him',
      summary: 'The queen\u2019s son, exiled for asking one question too loudly.',
      description: 'Aldric wanted to know what his mother saw at the Stormborder. The asking cost him his title; the not-knowing may cost him more. He now sails with Kael Dustwind under a false name, learning ropework, cards, and how little exiles inherit.',
      tags: ['royalty', 'exile'],
    });
    const sylva = E('character', 'Warden Sylva', {
      role: 'Guardian of the Glasswood', age: 'older than the calendar', pronouns: 'she/her',
      summary: 'The forest\u2019s own answer to trespass, treaties, and time.',
      description: 'When the Sundering fused the forest to glass, something in it woke up. Sylva has guarded the Glasswood ever since, honouring the Accords to the letter \u2014 and the letter is thorned.',
      tags: ['guardian', 'glasswood'],
    });

    /* ----- locations ----- */
    const spire = E('location', 'Aethermoor Spire', {
      kind: 'Floating citadel',
      summary: 'A city adrift above the clouds, chained to the world by nine great anchors.',
      description: 'Before the Sundering the Spire was the heart of an empire. Now it hangs at the centre of the map, its lower districts dangling into open sky, its archives still lit by lamps no one refills.',
      tags: ['wonder', 'sky-realm'],
    });
    const cinder = E('location', 'Port Cinder', {
      kind: 'Smuggler city',
      summary: 'Built inside the caldera of a volcano that is definitely, probably extinct.',
      description: 'No taxes, no questions, and one rule: fences stay mended and feuds stay outside the gates. Every crate in the Dustreach passes through Cinder\u2019s black-market bazaars at least once.',
      tags: ['port', 'lawless'],
    });
    const glasswood = E('location', 'The Glasswood', {
      kind: 'Enchanted forest',
      summary: 'A forest fused to glass by the Sundering, where light moves like water.',
      description: 'The trees did not burn \u2014 they vitrified. Walkers describe a cathedral of green light; few describe the sound the branches make when they shift, because few hear it twice.',
      tags: ['forest', 'strange'],
    });
    const vaelhold = E('location', 'Vaelhold', {
      kind: 'Capital city',
      summary: 'Seat of the Vael dynasty, crowned in lightning rods.',
      description: 'Every roof in Vaelhold carries a copper spike. It is not for decoration \u2014 the city stands in the storm\u2019s path, and the storm has a queen\u2019s permission to visit.',
      tags: ['capital', 'fortified'],
    });

    /* ----- kingdoms ----- */
    const vaelKingdom = E('kingdom', 'Kingdom of Vael', {
      ruler: 'Queen Isolde Vael', capital: vaelhold.id, founded: 'Year 108',
      summary: 'The last great realm of the lowlands, holding the line against the storm.',
      description: 'Vael\u2019s banners show a crown inside a lightning ring. Its fleets patrol the Stormborder, and its treaties \u2014 including the Glasswood Accords \u2014 are read aloud in every market square on the first frost.',
      tags: ['monarchy', 'lowlands'],
    });
    const dustreach = E('kingdom', 'Dustreach Freeholds', {
      ruler: 'Council of Captains', capital: cinder.id, founded: 'Year 14',
      summary: 'A confederacy of harbour-towns that answers to no crown but its own.',
      description: 'Thirteen freeholds, thirteen votes, and one standing rule: the sea and sky stay open. The Council flies no single flag on purpose \u2014 flags invite sieges.',
      tags: ['confederacy', 'frontier'],
    });

    /* ----- factions ----- */
    const corsairs = E('faction', 'The Skybound Corsairs', {
      kind: 'Pirate armada', leader: 'Kael Dustwind',
      summary: 'Salvagers, smugglers, and sworn enemies of anyone who bills them for airspace.',
      description: 'Half armada, half trading company, the Corsairs claim the air between the anchor-chains. Their code is short: salvage is sacred, logs are lies, and the Gale Reckoning outranks everything.',
      tags: ['pirates', 'sky'],
    });
    const silentPage = E('faction', 'Order of the Silent Page', {
      kind: 'Scholarly order', leader: 'Archivist Mirren',
      summary: 'Historians who speak freely everywhere except inside their own archives.',
      description: 'The Order copies, verifies, and seals the historical record of the known world. Kingdoms tolerate them because everyone needs a witness eventually.',
      tags: ['knowledge', 'neutral'],
    });
    const syndicate = E('faction', 'The Cinder Syndicate', {
      kind: 'Criminal network', leader: 'Thorn',
      summary: 'If it can be stolen, fenced, or disappeared, the Syndicate has a price for it.',
      description: 'The Syndicate does not run Port Cinder \u2014 it runs everything Port Cinder pretends not to see. Its ledgers are said to include two kings, one admiral, and half the Council of Captains.',
      tags: ['crime', 'smuggling'],
    });

    const entries = [isolde, kael, mirren, thorn, aldric, sylva, spire, cinder, glasswood, vaelhold, vaelKingdom, dustreach, corsairs, silentPage, syndicate];

    /* ----- events ----- */
    const events = [
      {
        title: 'The Sundering of the Sky', era: '', year: 0, dateText: '', importance: 2,
        description: 'The floating continent of Aethermoor tore loose from the earth. Nine anchor-chains were cast in a single night to keep it from drifting beyond reach. Every calendar in the world begins here.',
        links: [spire.id, glasswood.id],
      },
      {
        title: 'Founding of Port Cinder', era: '', year: 14, dateText: '', importance: 1,
        description: 'Refugees and deserters settled the dead volcano\u2019s caldera and declared, in writing, that they had always been there. The Council of Captains formed soon after.',
        links: [cinder.id, dustreach.id],
      },
      {
        title: 'The Glasswood Accords', era: '', year: 208, dateText: '', importance: 1,
        description: 'Queen\u2019s envoys and the Warden of the Glasswood signed a peace of unusual precision: log one tree, plant three, and never take the glass. It has held for two centuries.',
        links: [vaelKingdom.id, sylva.id, glasswood.id],
      },
      {
        title: 'The Night of Long Shadows', era: '', year: 398, dateText: '', importance: 2,
        description: 'The ninth anchor-chain was sabotaged during a staged fire in the archives. The Spire listed toward the sea for a full season before the chains were re-forged. The culprit was never proven \u2014 the paperwork, oddly, survived.',
        links: [spire.id, thorn.id, mirren.id],
      },
      {
        title: 'Coronation of Queen Isolde', era: '', year: 410, dateText: '', importance: 1,
        description: 'Crowned three days after her father\u2019s fall, Isolde Vael flew to the Stormborder and returned with lightning bound in glass. The court stopped asking questions shortly afterwards.',
        links: [isolde.id, vaelKingdom.id],
      },
      {
        title: 'The Stormborder Anomaly', era: 'Present day', year: 412, dateText: '', importance: 2,
        description: 'A second sundering stirs at the edge of the map. The Corsairs report the wind changing direction mid-gale; the Order reports history arriving early. Both reports reached the Queen on the same day. She has not replied to either.',
        links: [isolde.id, kael.id, aldric.id],
      },
    ].map((ev) => ({ id: uid(), links: [], createdAt: t, updatedAt: t, ...ev }));

    /* ----- relationships ----- */
    const R = (from, to, label, kind) => ({ id: uid(), from: from.id, to: to.id, label, kind });
    const relationships = [
      R(isolde, aldric, 'Mother and son', 'family'),
      R(isolde, mirren, 'Trusted counsel', 'ally'),
      R(kael, thorn, 'Old score unsettled', 'rival'),
      R(kael, aldric, 'Co-conspirators', 'ally'),
      R(mirren, thorn, 'Hunted across nine cities', 'enemy'),
      R(sylva, isolde, 'The Accords pact', 'ally'),
    ];

    return {
      id: uid(),
      name: 'Aethermoor',
      tagline: 'A world of floating shards, storm-bound queens, and the pirates who sail between them.',
      genre: 'High Fantasy',
      theme: 'arcane',
      accent: '',
      cover: '',
      createdAt: t,
      updatedAt: t,
      entries,
      events,
      relationships,
    };
  }

  LK.demo = { build };
})();
