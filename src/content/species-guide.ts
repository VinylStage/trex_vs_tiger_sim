import type { FreeSpeciesId } from '../sim/free/species.ts';

/*
 * The curated words of the species guide (`/species/`, `/en/species/`, docs/PAGES.md#species-guide):
 * a scientific name and a short, neutral note per species, written separately in Korean and
 * English. No numbers live here: every number on the page is read from the registries at build
 * time (src/pages/species-page.ts). Content framing rules apply (CONTRIBUTING.md): no gore words,
 * 전투 불능 / incapacitated, no living humans.
 */

export interface SpeciesGuideEntry {
  /** Scientific name, shown in italics. */
  readonly scientific: string;
  /** One or two plain sentences about the animal and why it is in the roster. */
  readonly note: { readonly ko: string; readonly en: string };
}

export const SPECIES_GUIDE: Readonly<Record<FreeSpeciesId, SpeciesGuideEntry>> = {
  trex: {
    scientific: 'Tyrannosaurus rex',
    note: {
      ko: '백악기 말 북아메리카에 살았던 대형 수각류 공룡으로, 이 시뮬레이터의 기본 종입니다. 몸무게, 걷는 속도, 무는 힘은 화석을 연구한 논문의 값이고, 행동에 관한 값은 추정입니다.',
      en: 'A large theropod dinosaur of late-Cretaceous North America and the default species of the simulator. Its mass, walking speed and bite force come from fossil studies; its behaviour values are assumptions.',
    },
  },
  elephant: {
    scientific: 'Loxodonta africana',
    note: {
      ko: '지금 살아 있는 가장 큰 육상 동물입니다. 엄니, 코, 밀어내는 힘을 공격 값 하나로 묶어 다루고, 두꺼운 피부는 무리 동물에게 받는 피해를 줄이는 상수로 반영합니다.',
      en: 'The largest living land animal. Its tusks, trunk and pushing are folded into one strike value, and its thick skin into a constant that lowers the damage it takes from latching animals.',
    },
  },
  buffalo: {
    scientific: 'Syncerus caffer',
    note: {
      ko: '아프리카 사바나에 사는 큰 소과 동물입니다. 사자 무리의 주요 먹이이면서, 사자를 밀어낸 기록도 많이 남아 있습니다.',
      en: 'A large bovid of the African savanna. It is a staple prey of lion prides and is also often recorded driving lions off.',
    },
  },
  brownBear: {
    scientific: 'Ursus arctos',
    note: {
      ko: '북반구에 널리 사는 곰입니다. 먹이를 두고 늑대 무리와 맞선 기록과, 러시아 극동에서 아무르호랑이와 마주친 기록이 있습니다.',
      en: 'A bear of the whole northern hemisphere. It is recorded facing wolf packs over carcasses and meeting Amur tigers in the Russian Far East.',
    },
  },
  mammoth: {
    scientific: 'Mammuthus primigenius',
    note: {
      ko: '빙하기 초원에 살았던 코끼리과 동물입니다. 얼어붙은 채 발견된 개체 덕분에 몸 크기 자료는 좋은 편이지만, 속도와 엄니 값은 현생 코끼리에서 유도하거나 추정했습니다.',
      en: 'An elephant of the glacial-period steppe. Frozen finds give good body-size data; its speed and tusk values are derived from living elephants or assumed.',
    },
  },
  homoErectus: {
    scientific: 'Homo erectus',
    note: {
      ko: '약 190만 년 전부터 살았던 멸종 인류입니다. 다른 동물과 같은 조건으로, 옷 · 도구 · 무기 · 불 · 훈련 없이 평균 성인의 신체 능력만 모델링했습니다. 현생 인류는 다루지 않습니다.',
      en: 'An extinct hominin that appeared about 1.9 million years ago. Like every other species it is modelled on an average adult’s physical capability only, without clothing, tools, weapons, fire or training. Living humans are not modelled.',
    },
  },
  tiger: {
    scientific: 'Panthera tigris',
    note: {
      ko: '가장 큰 고양잇과 동물로, 혼자 사냥합니다. 이 시뮬레이터의 기본 상대 종이며, 큰 먹이에 매달려 버티는 방식으로 싸웁니다.',
      en: 'The largest cat, and a solitary hunter. It is the simulator’s default opponent and fights by grabbing and holding on to larger prey.',
    },
  },
  lion: {
    scientific: 'Panthera leo',
    note: {
      ko: '무리를 지어 큰 먹이를 사냥하는 고양잇과 동물입니다. 무리 사냥 자료가 가장 잘 정리된 종이라 무리 버프의 기준이 됩니다.',
      en: 'A cat that hunts large prey in groups. It is the best-documented group hunter of large prey, so it anchors the pack buff.',
    },
  },
  wolf: {
    scientific: 'Canis lupus',
    note: {
      ko: '무리를 지어 사냥하는 갯과 동물입니다. 무리 크기에 따라 사냥 성공률이 어떻게 달라지는지에 대한 현장 자료가 가장 풍부합니다.',
      en: 'A canid that hunts in packs. It has the richest field data on how hunting success changes with group size.',
    },
  },
  hyena: {
    scientific: 'Crocuta crocuta',
    note: {
      ko: '큰 무리(클랜)를 이루고 먹이를 오래 쫓는 사냥을 합니다. 무는 힘이 측정되어 있고, 사자와 먹이를 두고 경쟁합니다.',
      en: 'It lives in large clans and hunts by long chases. Its bite force has been measured, and it competes with lions for food.',
    },
  },
};
