// Données de démonstration. À remplacer par l'export du logiciel de caisse.
// unit : 'piece' (prix à l'unité) ou 'kg' (prix au kilo, poids ajusté à la préparation)
// temp : 'sec', 'frais' ou 'surgele' (pour les sacs et la chaîne du froid)

export const CATEGORIES = [
  { id: 'fruits-legumes', name: 'Fruits et légumes', emoji: '🥕', aisle: 1 },
  { id: 'boulangerie', name: 'Boulangerie', emoji: '🥖', aisle: 2 },
  { id: 'epicerie', name: 'Épicerie', emoji: '🥫', aisle: 3 },
  { id: 'boissons', name: 'Boissons', emoji: '🧃', aisle: 4 },
  { id: 'cremerie', name: 'Crèmerie', emoji: '🧀', aisle: 5 },
  { id: 'boucherie', name: 'Boucherie', emoji: '🥩', aisle: 6 },
  { id: 'surgeles', name: 'Surgelés', emoji: '🧊', aisle: 7 },
];

const P = (id, name, cat, price, unit, extra = {}) => ({
  id, name, cat, price, unit,
  step: unit === 'kg' ? 0.25 : 1,
  available: true,
  temp: 'sec',
  format: '',
  origin: '',
  emoji: '🛒',
  ...extra,
});

export const PRODUCTS = [
  P('tomate', 'Tomates grappe', 'fruits-legumes', 3.49, 'kg', { origin: 'France', emoji: '🍅' }),
  P('pomme', 'Pommes Golden', 'fruits-legumes', 2.29, 'kg', { origin: 'France', emoji: '🍎' }),
  P('banane', 'Bananes', 'fruits-legumes', 1.99, 'kg', { origin: "Côte d'Ivoire", emoji: '🍌' }),
  P('pdt', 'Pommes de terre', 'fruits-legumes', 1.49, 'kg', { origin: 'France', emoji: '🥔', step: 0.5 }),
  P('oignon', 'Oignons jaunes', 'fruits-legumes', 1.79, 'kg', { origin: 'France', emoji: '🧅' }),
  P('carotte', 'Carottes', 'fruits-legumes', 1.39, 'kg', { origin: 'France', emoji: '🥕' }),
  P('citron', 'Citrons', 'fruits-legumes', 3.2, 'kg', { origin: 'Espagne', emoji: '🍋' }),
  P('salade', 'Salade batavia', 'fruits-legumes', 1.1, 'piece', { origin: 'France', emoji: '🥬', temp: 'frais' }),
  P('avocat', 'Avocat', 'fruits-legumes', 0.99, 'piece', { origin: 'Pérou', emoji: '🥑', available: false }),

  P('baguette', 'Baguette tradition', 'boulangerie', 1.2, 'piece', { emoji: '🥖' }),
  P('campagne', 'Pain de campagne', 'boulangerie', 2.9, 'piece', { format: '500 g', emoji: '🍞' }),
  P('croissant', 'Croissants', 'boulangerie', 3.6, 'piece', { format: 'x4', emoji: '🥐' }),

  P('riz', 'Riz basmati', 'epicerie', 2.89, 'piece', { format: '1 kg', emoji: '🍚' }),
  P('pates', 'Pâtes penne', 'epicerie', 1.35, 'piece', { format: '500 g', emoji: '🍝' }),
  P('huile', "Huile d'olive vierge extra", 'epicerie', 8.9, 'piece', { format: '1 L', emoji: '🫒' }),
  P('cafe', 'Café moulu', 'epicerie', 3.99, 'piece', { format: '250 g', emoji: '☕' }),
  P('the', 'Thé vert à la menthe', 'epicerie', 2.5, 'piece', { format: '100 g', emoji: '🍵' }),
  P('poischiche', 'Pois chiches', 'epicerie', 1.1, 'piece', { format: '400 g', emoji: '🥫' }),
  P('miel', 'Miel de fleurs', 'epicerie', 6.9, 'piece', { format: '500 g', emoji: '🍯' }),

  P('eau', 'Eau minérale', 'boissons', 2.99, 'piece', { format: '6 x 1,5 L', emoji: '💧', max: 4 }),
  P('jus', "Jus d'orange", 'boissons', 2.49, 'piece', { format: '1 L', emoji: '🧃' }),

  P('lait', 'Lait demi-écrémé', 'cremerie', 1.09, 'piece', { format: '1 L', emoji: '🥛', temp: 'frais' }),
  P('oeufs', 'Œufs plein air', 'cremerie', 3.79, 'piece', { format: 'x12', emoji: '🥚', temp: 'frais' }),
  P('beurre', 'Beurre doux', 'cremerie', 2.69, 'piece', { format: '250 g', emoji: '🧈', temp: 'frais' }),
  P('yaourt', 'Yaourts nature', 'cremerie', 2.49, 'piece', { format: 'x8', emoji: '🥣', temp: 'frais' }),
  P('emmental', 'Emmental râpé', 'cremerie', 2.19, 'piece', { format: '200 g', emoji: '🧀', temp: 'frais' }),

  P('poulet', 'Poulet entier', 'boucherie', 6.9, 'kg', { origin: 'France', emoji: '🍗', temp: 'frais', step: 0.5 }),
  P('hache', 'Viande hachée 5 %', 'boucherie', 13.9, 'kg', { origin: 'France', emoji: '🥩', temp: 'frais' }),
  P('dinde', 'Escalopes de dinde', 'boucherie', 12.5, 'kg', { origin: 'France', emoji: '🍖', temp: 'frais' }),

  P('petitspois', 'Petits pois', 'surgeles', 2.39, 'piece', { format: '1 kg', emoji: '🫛', temp: 'surgele' }),
  P('frites', 'Frites', 'surgeles', 2.19, 'piece', { format: '1 kg', emoji: '🍟', temp: 'surgele' }),
  P('glace', 'Glace vanille', 'surgeles', 4.5, 'piece', { format: '1 L', emoji: '🍨', temp: 'surgele' }),
];

export const DEMO_CUSTOMERS = [
  { name: 'Fatima Benali', phone: '06 12 34 56 78', email: 'fatima.demo@example.com', plate: 'AB-123-CD' },
  { name: 'Julien Muller', phone: '06 98 76 54 32', email: 'julien.demo@example.com', plate: '' },
  { name: 'Sophie Laurent', phone: '07 11 22 33 44', email: 'sophie.demo@example.com', plate: 'EF-456-GH' },
  { name: 'Karim Haddad', phone: '06 55 44 33 22', email: 'karim.demo@example.com', plate: '' },
];
