const { cotarTodos } = require('./core/cotarTodos');

const usuarioId = '61ab64e4-c2cb-46df-bb14-6cc326293085';

const itens = [
  { produto: 'cimento 50kg', quantidade: 10 },
  { produto: 'areia média', quantidade: 5 },
];

cotarTodos(usuarioId, itens)
  .then((resultado) => console.log('Cotação finalizada:', resultado))
  .catch((erro) => console.error('Erro:', erro));
