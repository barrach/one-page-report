// Testa em qual projeto Supabase o login do MegaHub funciona.
// USO:  node scripts/test-login.mjs "seu@email.com" "suaSenha"
//   ou: EMAIL=... SENHA=... node scripts/test-login.mjs

const email = process.argv[2] || process.env.EMAIL;
const senha = process.argv[3] || process.env.SENHA;

if (!email || !senha) {
  console.error('Uso: node scripts/test-login.mjs "email" "senha"');
  process.exit(1);
}

const PROJECTS = [
  {
    nome: 'rlpmwuaaosmxlrqtruol (atual)',
    url: 'https://rlpmwuaaosmxlrqtruol.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscG13dWFhb3NteGxycXRydW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODg5OTUsImV4cCI6MjA5NTk2NDk5NX0.Es55o3SOH2jYZkKTe3wA_ZkL1qaefJw0oEZrB7lh25w',
  },
  {
    nome: 'bxmvzxtbjxlicjaewvfg (original/megahub)',
    url: 'https://bxmvzxtbjxlicjaewvfg.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bXZ6eHRianhsaWNqYWV3dmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjU3MDcsImV4cCI6MjA4NzAwMTcwN30.uM4H1zXJeLedPzTcsntolpP-JSuqyIIPqT4wQxqgOhI',
  },
  {
    nome: 'adpwboqltejtfzcvrvon (ProdControl)',
    url: 'https://adpwboqltejtfzcvrvon.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcHdib3FsdGVqdGZ6Y3Zydm9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTcwODUsImV4cCI6MjA4Njg5MzA4NX0.dgtNbEl2o4oVC0VOC-VevRkv4qap90Z7qsH2AdCFgic',
  },
];

const test = async (p) => {
  try {
    const res = await fetch(`${p.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: p.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.access_token) {
      return `✅ LOGIN OK  — ${p.nome}`;
    }
    return `❌ falhou (${res.status}: ${json.error_description || json.msg || json.error || 'erro'}) — ${p.nome}`;
  } catch (e) {
    return `⚠️  erro de rede — ${p.nome} (${e.message})`;
  }
};

console.log(`\nTestando login de ${email} nos 3 projetos...\n`);
for (const p of PROJECTS) {
  console.log(await test(p));
}
console.log('\nO projeto com "✅ LOGIN OK" é onde sua conta existe.\n');
