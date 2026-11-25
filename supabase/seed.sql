-- Proval Drive : catalogue de démonstration (à remplacer par le vrai catalogue via l'import CSV du back-office).
-- À exécuter après schema.sql.

insert into public.categories (id, name, emoji, aisle) values
  ('fruits-legumes', 'Fruits et légumes', '🥕', 1),
  ('boulangerie',    'Boulangerie',       '🥖', 2),
  ('epicerie',       'Épicerie',          '🥫', 3),
  ('boissons',       'Boissons',          '🧃', 4),
  ('cremerie',       'Crèmerie',          '🧀', 5),
  ('boucherie',      'Boucherie',         '🥩', 6),
  ('surgeles',       'Surgelés',          '🧊', 7)
on conflict (id) do nothing;

insert into public.products (id, name, cat, price, unit, step, available, temp, format, origin, emoji, max_qty) values
  ('tomate',     'Tomates grappe',             'fruits-legumes', 3.49, 'kg',    0.25, true,  'sec',     '',          'France',        '🍅', null),
  ('pomme',      'Pommes Golden',              'fruits-legumes', 2.29, 'kg',    0.25, true,  'sec',     '',          'France',        '🍎', null),
  ('banane',     'Bananes',                    'fruits-legumes', 1.99, 'kg',    0.25, true,  'sec',     '',          'Côte d''Ivoire', '🍌', null),
  ('pdt',        'Pommes de terre',            'fruits-legumes', 1.49, 'kg',    0.5,  true,  'sec',     '',          'France',        '🥔', null),
  ('oignon',     'Oignons jaunes',             'fruits-legumes', 1.79, 'kg',    0.25, true,  'sec',     '',          'France',        '🧅', null),
  ('carotte',    'Carottes',                   'fruits-legumes', 1.39, 'kg',    0.25, true,  'sec',     '',          'France',        '🥕', null),
  ('citron',     'Citrons',                    'fruits-legumes', 3.20, 'kg',    0.25, true,  'sec',     '',          'Espagne',       '🍋', null),
  ('salade',     'Salade batavia',             'fruits-legumes', 1.10, 'piece', 1,    true,  'frais',   '',          'France',        '🥬', null),
  ('avocat',     'Avocat',                     'fruits-legumes', 0.99, 'piece', 1,    false, 'sec',     '',          'Pérou',         '🥑', null),
  ('baguette',   'Baguette tradition',         'boulangerie',    1.20, 'piece', 1,    true,  'sec',     '',          '',              '🥖', null),
  ('campagne',   'Pain de campagne',           'boulangerie',    2.90, 'piece', 1,    true,  'sec',     '500 g',     '',              '🍞', null),
  ('croissant',  'Croissants',                 'boulangerie',    3.60, 'piece', 1,    true,  'sec',     'x4',        '',              '🥐', null),
  ('riz',        'Riz basmati',                'epicerie',       2.89, 'piece', 1,    true,  'sec',     '1 kg',      '',              '🍚', null),
  ('pates',      'Pâtes penne',                'epicerie',       1.35, 'piece', 1,    true,  'sec',     '500 g',     '',              '🍝', null),
  ('huile',      'Huile d''olive vierge extra', 'epicerie',      8.90, 'piece', 1,    true,  'sec',     '1 L',       '',              '🫒', null),
  ('cafe',       'Café moulu',                 'epicerie',       3.99, 'piece', 1,    true,  'sec',     '250 g',     '',              '☕', null),
  ('the',        'Thé vert à la menthe',       'epicerie',       2.50, 'piece', 1,    true,  'sec',     '100 g',     '',              '🍵', null),
  ('poischiche', 'Pois chiches',               'epicerie',       1.10, 'piece', 1,    true,  'sec',     '400 g',     '',              '🥫', null),
  ('miel',       'Miel de fleurs',             'epicerie',       6.90, 'piece', 1,    true,  'sec',     '500 g',     '',              '🍯', null),
  ('eau',        'Eau minérale',               'boissons',       2.99, 'piece', 1,    true,  'sec',     '6 x 1,5 L', '',              '💧', 4),
  ('jus',        'Jus d''orange',              'boissons',       2.49, 'piece', 1,    true,  'sec',     '1 L',       '',              '🧃', null),
  ('lait',       'Lait demi-écrémé',           'cremerie',       1.09, 'piece', 1,    true,  'frais',   '1 L',       '',              '🥛', null),
  ('oeufs',      'Œufs plein air',             'cremerie',       3.79, 'piece', 1,    true,  'frais',   'x12',       '',              '🥚', null),
  ('beurre',     'Beurre doux',                'cremerie',       2.69, 'piece', 1,    true,  'frais',   '250 g',     '',              '🧈', null),
  ('yaourt',     'Yaourts nature',             'cremerie',       2.49, 'piece', 1,    true,  'frais',   'x8',        '',              '🥣', null),
  ('emmental',   'Emmental râpé',              'cremerie',       2.19, 'piece', 1,    true,  'frais',   '200 g',     '',              '🧀', null),
  ('poulet',     'Poulet entier',              'boucherie',      6.90, 'kg',    0.5,  true,  'frais',   '',          'France',        '🍗', null),
  ('hache',      'Viande hachée 5 %',          'boucherie',     13.90, 'kg',    0.25, true,  'frais',   '',          'France',        '🥩', null),
  ('dinde',      'Escalopes de dinde',         'boucherie',     12.50, 'kg',    0.25, true,  'frais',   '',          'France',        '🍖', null),
  ('petitspois', 'Petits pois',                'surgeles',       2.39, 'piece', 1,    true,  'surgele', '1 kg',      '',              '🫛', null),
  ('frites',     'Frites',                     'surgeles',       2.19, 'piece', 1,    true,  'surgele', '1 kg',      '',              '🍟', null),
  ('glace',      'Glace vanille',              'surgeles',       4.50, 'piece', 1,    true,  'surgele', '1 L',       '',              '🍨', null)
on conflict (id) do nothing;
