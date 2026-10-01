export const dummyTables = [
  {
    name: 'users',
    createSql: 'CREATE TABLE users (user_id VARCHAR, username VARCHAR, email VARCHAR, role VARCHAR, created_at DATE);',
    insertSql: "INSERT INTO users VALUES ('U1', 'john_doe', 'john@example.com', 'customer', '2023-01-15'), ('U2', 'jane_smith', 'jane@example.com', 'customer', '2023-02-20'), ('U3', 'budi_admin', 'budi@company.com', 'admin', '2022-11-10'), ('U4', 'siti_staff', 'siti@company.com', 'employee', '2023-03-05');"
  },
  {
    name: 'employees',
    createSql: 'CREATE TABLE employees (employee_id VARCHAR, user_id VARCHAR, first_name VARCHAR, last_name VARCHAR, department VARCHAR, salary DECIMAL, hire_date DATE);',
    insertSql: "INSERT INTO employees VALUES ('E1', 'U4', 'Siti', 'Aminah', 'Sales', 5000000, '2023-03-05'), ('E2', NULL, 'Agus', 'Pratama', 'Logistic', 4500000, '2022-05-12'), ('E3', NULL, 'Rina', 'Wati', 'HR', 6000000, '2021-08-22');"
  },
  {
    name: 'hr_evaluations',
    createSql: 'CREATE TABLE hr_evaluations (evaluation_id VARCHAR, employee_id VARCHAR, performance_rating INT, evaluation_date DATE, notes VARCHAR);',
    insertSql: "INSERT INTO hr_evaluations VALUES ('HR1', 'E1', 4, '2023-12-15', 'Good sales record'), ('HR2', 'E2', 3, '2023-12-16', 'Average performance'), ('HR3', 'E3', 5, '2023-12-10', 'Excellent management');"
  },
  {
    name: 'products',
    createSql: 'CREATE TABLE products (product_id VARCHAR, product_name VARCHAR, category VARCHAR, price DECIMAL, stock_quantity INT);',
    insertSql: "INSERT INTO products VALUES ('P1', 'Laptop Pro', 'Electronics', 15000000, 10), ('P2', 'Wireless Mouse', 'Electronics', 250000, 50), ('P3', 'Office Chair', 'Furniture', 1200000, 20), ('P4', 'Mechanical Keyboard', 'Electronics', 850000, 30);"
  },
  {
    name: 'orders',
    createSql: 'CREATE TABLE orders (order_id VARCHAR, user_id VARCHAR, order_date DATE, total_amount DECIMAL, status VARCHAR);',
    insertSql: "INSERT INTO orders VALUES ('O1', 'U1', '2023-10-01', 15250000, 'Completed'), ('O2', 'U2', '2023-10-05', 1200000, 'Shipped'), ('O3', 'U1', '2023-10-10', 850000, 'Pending');"
  },
  {
    name: 'order_items',
    createSql: 'CREATE TABLE order_items (item_id VARCHAR, order_id VARCHAR, product_id VARCHAR, quantity INT, unit_price DECIMAL);',
    insertSql: "INSERT INTO order_items VALUES ('I1', 'O1', 'P1', 1, 15000000), ('I2', 'O1', 'P2', 1, 250000), ('I3', 'O2', 'P3', 1, 1200000), ('I4', 'O3', 'P4', 1, 850000);"
  },
  {
    name: 'logistics',
    createSql: 'CREATE TABLE logistics (logistic_id VARCHAR, order_id VARCHAR, employee_id VARCHAR, shipping_provider VARCHAR, status VARCHAR, delivery_date DATE);',
    insertSql: "INSERT INTO logistics VALUES ('L1', 'O1', 'E2', 'FastKurir', 'Delivered', '2023-10-03'), ('L2', 'O2', 'E2', 'FastKurir', 'In Transit', NULL);"
  }
];
