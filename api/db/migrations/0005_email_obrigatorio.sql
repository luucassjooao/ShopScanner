-- E-mail é obrigatório. Todo caminho de criação já exige e-mail (cadastro pede,
-- Google só entra com e-mail verificado), então a coluna nasceu nullable por
-- prevenção a um login por TikTok que o contrato descartou. Agora é constraint
-- no banco, não guarda no app.

alter table users alter column email set not null;
alter table auth_identities alter column email set not null;
