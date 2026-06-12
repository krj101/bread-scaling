const DEFAULT_DATA = {
  version: 1,
  sizes: [
    { id: 'size-2kin',  name: '2 kin',    doughGrams: 907 },
    { id: 'size-15kin', name: '1.5 kin', doughGrams: 680 },
    { id: 'burger-bun', name: 'burger bun', doughGrams: 120 }, 
    { id: 'hotdog-bun', name: 'hot dog bun', doughGrams: 90 },
  ],
  recipes: [
    {
      id: 'recipe-dishsoap',
      name: 'KJ Base Recipe',
      groups: [
        {
          name: 'Tangzhong',
          ingredients: [
            { name: 'Water',      pct: 21.6 },
            { name: 'Rice flour', pct:  5.6 },
          ],
        },
        {
          name: 'Main dough',
          ingredients: [
            { name: 'Milk',         pct:  14.4  },
            { name: 'Yeast',        pct:   2.24 },
            { name: 'Bread flour',  pct: 100    },
            { name: 'Egg',          pct:  16    },
            { name: 'Brown sugar',  pct:   8    },
            { name: 'Rice syrup',   pct:   3.2  },
            { name: 'Buttermilk',   pct:   8    },
            { name: 'Milk powder',  pct:   2.4  },
            { name: 'Salt',         pct:   1.6  },
            { name: 'Butter',       pct:   9.6  },
          ],
        },
      ],
    },
  ],
};
