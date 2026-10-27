import { Course, Achievement } from '../types';

export const COURSES: Course[] = [
  {
    id: 'five-pillars',
    title: 'Five Pillars of Islam',
    arabicTitle: 'أركان الإسلام الخمسة',
    description: 'Master the fundamental foundations that uphold every Muslim\'s faith and life.',
    level: 'Beginner',
    category: 'Foundations',
    icon: 'Columns3',
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400',
    lessons: [
      {
        id: 'lesson-shahada',
        courseId: 'five-pillars',
        title: 'The Shahada (Testimony of Faith)',
        description: 'The key to Islam and the proclamation of Tawheed (monotheism).',
        icon: 'Sparkles',
        estimatedMinutes: 3,
        xp: 50,
        completed: false,
        steps: [
          {
            id: 's1',
            type: 'concept',
            title: 'What is the Shahada?',
            content: 'The Shahada is the first and greatest pillar of Islam. It is the sincere testimony that there is no god worthy of worship except Allah, and that Muhammad ﷺ is His Messenger.',
            arabicText: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ',
            transliteration: 'Ash-hadu an la ilaha illa Allah, wa ash-hadu anna Muhammadan Rasool Allah',
            explanation: 'Declaring this testimony with sincere conviction from the heart enters a person into the fold of Islam.',
            xpReward: 15,
          },
          {
            id: 's2',
            type: 'multiple-choice',
            title: 'Meaning of Tawheed',
            question: 'What does the first part of the Shahada establish?',
            options: [
              { id: 'o1', text: 'Singling out Allah alone in worship without partners', isCorrect: true },
              { id: 'o2', text: 'Fast every month of the year', isCorrect: false },
              { id: 'o3', text: 'Visiting the holy cities once a year', isCorrect: false },
            ],
            explanation: 'Tawheed is the belief in the absolute oneness of Allah in His Lordship, Worship, and Names & Attributes.',
            xpReward: 20,
          },
          {
            id: 's3',
            type: 'match',
            title: 'Knowledge Check',
            question: 'Who is the final Messenger sent as a mercy to all mankind?',
            options: [
              { id: 'm1', text: 'Prophet Muhammad ﷺ', isCorrect: true },
              { id: 'm2', text: 'Prophet Musa (Moses) عَلَيْهِ السَّلَام', isCorrect: false },
              { id: 'm3', text: 'Prophet Isa (Jesus) عَلَيْهِ السَّلَام', isCorrect: false },
            ],
            explanation: 'Prophet Muhammad ﷺ is the Seal of the Prophets sent to complete noble character and convey the final Qur\'an.',
            xpReward: 15,
          }
        ]
      },
      {
        id: 'lesson-salah-pillar',
        courseId: 'five-pillars',
        title: 'Salah (The Daily Prayers)',
        description: 'The direct spiritual connection between the believer and their Creator.',
        icon: 'Flame',
        estimatedMinutes: 4,
        xp: 60,
        completed: false,
        steps: [
          {
            id: 'sp1',
            type: 'concept',
            title: 'The Five Obligatory Prayers',
            content: 'Muslims establish five daily prayers at designated times: Fajr (Dawn), Dhuhr (Midday), Asr (Afternoon), Maghrib (Sunset), and Isha (Night).',
            arabicText: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا',
            transliteration: 'Indeed, prayer has been decreed upon the believers a decree of specified times. (Quran 4:103)',
            explanation: 'Salah purifies the soul, grounds daily life with mindfulness, and serves as the ascension (Mi\'raj) of the believer.',
            xpReward: 20,
          },
          {
            id: 'sp2',
            type: 'ordering',
            title: 'Order the Daily Prayers',
            question: 'Arrange the 5 daily prayers in chronological order from dawn to night:',
            orderItems: [
              { id: 'p1', text: 'Fajr (Dawn)', correctIndex: 0 },
              { id: 'p2', text: 'Dhuhr (Midday)', correctIndex: 1 },
              { id: 'p3', text: 'Asr (Late Afternoon)', correctIndex: 2 },
              { id: 'p4', text: 'Maghrib (Sunset)', correctIndex: 3 },
              { id: 'p5', text: 'Isha (Night)', correctIndex: 4 },
            ],
            explanation: 'Starting the day with Fajr and concluding with Isha establishes a serene spiritual rhythm.',
            xpReward: 25,
          },
          {
            id: 'sp3',
            type: 'multiple-choice',
            title: 'Spiritual Purpose of Prayer',
            question: 'What is a major spiritual fruit of establishing regular Salah?',
            options: [
              { id: 'so1', text: 'Remembrance of Allah and protection from wrongdoing', isCorrect: true },
              { id: 'so2', text: 'Physical exercise only', isCorrect: false },
              { id: 'so3', text: 'Accumulating material wealth', isCorrect: false },
            ],
            explanation: 'Allah states: "Establish prayer. Indeed, prayer prohibits immorality and wrongdoing, and the remembrance of Allah is greater." (29:45)',
            xpReward: 15,
          }
        ]
      },
      {
        id: 'lesson-zakat',
        courseId: 'five-pillars',
        title: 'Zakat (Purification & Charity)',
        description: 'Purifying wealth through compassion and social justice.',
        icon: 'HeartHandshake',
        estimatedMinutes: 3,
        xp: 50,
        completed: false,
        steps: [
          {
            id: 'z1',
            type: 'concept',
            title: 'Understanding Zakat',
            content: 'Zakat is an obligatory 2.5% annual contribution on eligible surplus wealth, given to the poor, needy, and vulnerable in society.',
            explanation: 'The word Zakat linguistically means "purification" and "growth", reminding us that wealth belongs ultimately to Allah.',
            xpReward: 15,
          },
          {
            id: 'z2',
            type: 'multiple-choice',
            title: 'Standard Rate of Zakat',
            question: 'What is the standard annual rate of Zakat on qualifying savings above the Nisab threshold?',
            options: [
              { id: 'zo1', text: '2.5%', isCorrect: true },
              { id: 'zo2', text: '10%', isCorrect: false },
              { id: 'zo3', text: '20%', isCorrect: false },
            ],
            explanation: 'The standard annual zakat rate for liquid wealth and gold/silver is 2.5% (one fortieth).',
            xpReward: 20,
          },
          {
            id: 'z3',
            type: 'multiple-choice',
            title: 'Sadaqah vs Zakat',
            question: 'What is the difference between Zakat and general Sadaqah?',
            options: [
              { id: 'sd1', text: 'Zakat is mandatory with specific rules; Sadaqah is voluntary charity at any time', isCorrect: true },
              { id: 'sd2', text: 'They are identical with no difference', isCorrect: false },
              { id: 'sd3', text: 'Zakat is only for non-Muslims', isCorrect: false },
            ],
            explanation: 'Even a smile or kind word is considered Sadaqah (voluntary charity) in Islam!',
            xpReward: 15,
          }
        ]
      }
    ]
  },
  {
    id: 'wudu-purity',
    title: 'Wudu (Purification & Ablution)',
    arabicTitle: 'الطهارة والوضوء',
    description: 'Learn the sacred step-by-step physical and spiritual purification before standing before Allah.',
    level: 'Beginner',
    category: 'Practice',
    icon: 'Droplets',
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400',
    lessons: [
      {
        id: 'lesson-wudu-steps',
        courseId: 'wudu-purity',
        title: 'Step-by-Step Wudu',
        description: 'Master the Sunnah sequence of washing with mindfulness.',
        icon: 'Waves',
        estimatedMinutes: 4,
        xp: 60,
        completed: false,
        steps: [
          {
            id: 'w1',
            type: 'concept',
            title: 'The Intention & Bismillah',
            content: 'Begin by forming a silent sincere intention (Niyyah) in the heart to purify yourself for Allah, then say "Bismillah" (In the Name of Allah).',
            arabicText: 'بِسْمِ اللَّهِ',
            transliteration: 'Bismillah',
            explanation: 'Purity of intention is the foundation of all righteous deeds.',
            xpReward: 15,
          },
          {
            id: 'w2',
            type: 'ordering',
            title: 'Sequence of Wudu',
            question: 'Order these essential steps of Wudu correctly:',
            orderItems: [
              { id: 'ws1', text: 'Wash hands up to wrists (3x)', correctIndex: 0 },
              { id: 'ws2', text: 'Rinse mouth and sniff water into nose (3x)', correctIndex: 1 },
              { id: 'ws3', text: 'Wash the entire face (3x)', correctIndex: 2 },
              { id: 'ws4', text: 'Wash arms up to elbows starting with right (3x)', correctIndex: 3 },
              { id: 'ws5', text: 'Wipe wet hands over head & clean ears (1x)', correctIndex: 4 },
              { id: 'ws6', text: 'Wash feet up to ankles starting with right (3x)', correctIndex: 5 },
            ],
            explanation: 'The Prophet ﷺ taught this harmonious sequence, bringing physical clarity and washing away sins.',
            xpReward: 25,
          },
          {
            id: 'w3',
            type: 'multiple-choice',
            title: 'Dua after Wudu',
            question: 'What is recommended to recite after finishing Wudu?',
            options: [
              { id: 'dw1', text: 'The Shahada and supplication for purification', isCorrect: true },
              { id: 'dw2', text: 'Surah Al-Baqarah completely', isCorrect: false },
              { id: 'dw3', text: 'Nothing at all', isCorrect: false },
            ],
            explanation: 'The Prophet ﷺ said whoever says the Shahada and "O Allah make me of the repentant and purified" will have the eight gates of Paradise opened.',
            xpReward: 20,
          }
        ]
      }
    ]
  },
  {
    id: 'islamic-manners',
    title: 'Islamic Manners (Akhlaq & Adab)',
    arabicTitle: 'الأخلاق الإسلامية والآداب',
    description: 'Embody the beautiful character of the Prophet ﷺ in speech, gratitude, patience, and kindness.',
    level: 'Intermediate',
    category: 'Character',
    icon: 'Heart',
    color: 'from-amber-500/20 to-orange-500/10 text-amber-400',
    lessons: [
      {
        id: 'lesson-sabr-shukr',
        courseId: 'islamic-manners',
        title: 'Sabr (Patience) & Shukr (Gratitude)',
        description: 'The two golden wings of the believer in trials and blessings.',
        icon: 'Sun',
        estimatedMinutes: 4,
        xp: 55,
        completed: false,
        steps: [
          {
            id: 'sb1',
            type: 'concept',
            title: 'The Balance of the Believer',
            content: 'Prophet Muhammad ﷺ said: "How wonderful is the affair of the believer, for his affairs are all good... If something good happens to him, he gives thanks (Shukr), and that is good for him. If something bad happens to him, he bears it with patience (Sabr), and that is good for him." (Muslim)',
            explanation: 'No state of a conscious believer is ever wasted; hardship yields reward through endurance, and ease yields reward through gratitude.',
            xpReward: 20,
          },
          {
            id: 'sb2',
            type: 'multiple-choice',
            title: 'Quranic Promise for Sabr',
            question: 'What does Allah promise to those who exercise patience in Surah Al-Baqarah (2:153)?',
            options: [
              { id: 'sbq1', text: 'Indeed, Allah is with those who are patient ("إِنَّ اللَّهَ مَعَ الصَّابِرِينَ")', isCorrect: true },
              { id: 'sbq2', text: 'That they will never face any difficulty', isCorrect: false },
              { id: 'sbq3', text: 'Instant worldly fortune', isCorrect: false },
            ],
            explanation: 'Allah\'s divine companionship, comfort, and ultimate aid accompany the patient heart.',
            xpReward: 20,
          },
          {
            id: 'sb3',
            type: 'multiple-choice',
            title: 'Honoring Parents',
            question: 'What does the Qur\'an teach regarding our speech with our parents (Surah Al-Isra 17:23)?',
            options: [
              { id: 'pr1', text: 'Do not say even "Uff" to them, and speak to them with honor and gentleness', isCorrect: true },
              { id: 'pr2', text: 'Only obey them when convenient', isCorrect: false },
              { id: 'pr3', text: 'Argue back if you disagree', isCorrect: false },
            ],
            explanation: 'Kindness (Birr) to parents is placed right after monotheism in prominence across the Qur\'an.',
            xpReward: 15,
          }
        ]
      }
    ]
  },
  {
    id: 'quranic-vocabulary',
    title: 'Qur\'anic Vocabulary & Keys',
    arabicTitle: 'مفردات ومفاتيح القرآن الكريم',
    description: 'Learn the most frequent and profound root words in the Holy Qur\'an.',
    level: 'Intermediate',
    category: 'Language',
    icon: 'BookOpen',
    color: 'from-purple-500/20 to-indigo-500/10 text-purple-400',
    lessons: [
      {
        id: 'lesson-core-roots',
        courseId: 'quranic-vocabulary',
        title: 'Taqwa, Rahmah & Tawakkul',
        description: 'Explore three profound core virtues that transform spiritual life.',
        icon: 'Compass',
        estimatedMinutes: 3,
        xp: 50,
        completed: false,
        steps: [
          {
            id: 'v1',
            type: 'concept',
            title: 'Taqwa (تقوى)',
            content: 'Taqwa is conscious reverence and awe of Allah — creating a protective shield between oneself and anything that displeases Allah.',
            arabicText: 'تَقْوَى',
            transliteration: 'Taqwa (God-consciousness / Reverence)',
            explanation: 'Ali ibn Abi Talib (RA) defined Taqwa as: "Fear of the Almighty, acting upon the revelation, contentment with little, and preparing for the Day of Departure."',
            xpReward: 15,
          },
          {
            id: 'v2',
            type: 'multiple-choice',
            title: 'Tawakkul (تَوَكُّل)',
            question: 'What does true Tawakkul mean?',
            options: [
              { id: 'tw1', text: 'Taking all righteous means/action while placing ultimate trust solely in Allah', isCorrect: true },
              { id: 'tw2', text: 'Doing nothing and expecting miracles without effort', isCorrect: false },
              { id: 'tw3', text: 'Relying solely on one\'s own intelligence', isCorrect: false },
            ],
            explanation: 'The Prophet ﷺ instructed: "Tie your camel, and then place your trust in Allah." (Tirmidhi)',
            xpReward: 20,
          },
          {
            id: 'v3',
            type: 'multiple-choice',
            title: 'Rahmah (رَحْمَة)',
            question: 'Which two names of Allah derived from Rahmah are in the Basmalah?',
            options: [
              { id: 'rm1', text: 'Ar-Rahman (The Entirely Merciful) and Ar-Raheem (The Especially Merciful)', isCorrect: true },
              { id: 'rm2', text: 'Al-Qawiyy and Al-Matin', isCorrect: false },
              { id: 'rm3', text: 'Al-Khaliq and Al-Bari', isCorrect: false },
            ],
            explanation: 'Allah\'s mercy encompasses all things and precedes His anger.',
            xpReward: 15,
          }
        ]
      }
    ]
  }
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-step',
    title: 'First Step of Light',
    description: 'Complete your first lesson in Noor Learn',
    icon: 'Footprints',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'streak-seeker',
    title: 'Steadfast Seeker',
    description: 'Maintain a 3-day active streak in worship & study',
    icon: 'Flame',
    unlocked: false,
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'quran-reader',
    title: 'Guardian of the Verses',
    description: 'Read 5 pages of the Holy Qur\'an',
    icon: 'BookMarked',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'dhikr-lover',
    title: 'Constant Remembrance',
    description: 'Complete 100 Tasbih and Dhikr counts',
    icon: 'Heart',
    unlocked: false,
    progress: 0,
    maxProgress: 100,
  },
  {
    id: 'noor-scholar',
    title: 'Student of Wisdom',
    description: 'Earn 150 XP across all learning paths',
    icon: 'Award',
    unlocked: false,
    progress: 0,
    maxProgress: 150,
  }
];
