-- Query customer phone format
SELECT id, name, phone FROM customers WHERE name LIKE '%Nasrul%' OR name LIKE '%Mufid%';
-- Coba pattern matching
SELECT id, name, phone FROM customers WHERE phone LIKE '%6282281501145%';
SELECT id, name, phone FROM customers WHERE phone LIKE '%0282281501145%';
SELECT id, name, phone FROM customers WHERE phone LIKE '%2281501145%';
SELECT id, name, phone FROM customers WHERE REPLACE(REPLACE(phone, '+', ''), '-', '') LIKE '%6282281501145%';