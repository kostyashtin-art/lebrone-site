(() => {
  const lines = [
    "Артем бил крипов 26 минут и вы проиграли, хотите убедиться, что он затролил",
    "Кирилл ушел с лайн на 2 минуте",
    "Ильшату не сделали тп на 20 минуте в мид",
    "Не купили всей командой глиммер для сейва мидера",
    "На тройке опять молчит",
    "Сейчас бы МакКомбо, а не это все",
    "Блин, можно было бы вывести деньги из Доты на починку Соляриса",
    "Инсаф опять на Пудже с армлетом, сука",
    "Кто, блядь, нажал смок после того, как вся команда разошлась?",
    "Минус Рошан, минус тавер, минус настроение — ну и кто затроллил?",
    "Да ё-моё, варды стоят, а смотреть на миникарту никто не хочет"
  ];
  const el = document.getElementById('randomTagline');
  if (!el) return;
  let previous = -1;
  const choose = () => {
    let index;
    do { index = Math.floor(Math.random() * lines.length); } while (lines.length > 1 && index === previous);
    previous = index;
    el.classList.add('tagline-changing');
    window.setTimeout(() => { el.textContent = lines[index]; el.classList.remove('tagline-changing'); }, 180);
  };
  // Random line on each visit, then rotate periodically.
  choose();
  window.setInterval(choose, 5000);
})();
