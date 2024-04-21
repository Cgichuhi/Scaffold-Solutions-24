const express = require("express");
const cors = require("cors");
const pool =require("./Database");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();

//middleware
app.use(express.json());
app.use(cors());
app.use("/image", express.static(path.join(__dirname, "public/image")));

// Middleware function to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers.authorization;
  
    if (!token) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." });
    }
  
    try {
      const decoded = jwt.verify(token.split(" ")[1], "secretKey"); // Extract token from "Bearer <token>"
      req.userId = decoded.userId;
      next();
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  }

  // Upload files with Multer
// Storage where the images will be stored in the backend
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/image");
    },
    filename: (req, file, cb) => {
      cb(
        null,
        file.fieldname + "-" + Date.now() + path.extname(file.originalname)
      );
    },
  });
  
  // Upload
  const upload = multer({ storage });

// //////////Endpoint routes (APIs)

// Create a new product entry
app.post("/api/v1/createproduct", upload.single("image") , async (req,res) => {
    try {
        // Extract product data from the request body
        const{product_name, product_description, price, availability} = req.body;
        
        // Extract image data from the uploaded file
        const { filename, path: filepath, mimetype, size } = req.file;

        // Insert the new product into the database
        const newProduct = await pool.query(
            "INSERT INTO product (product_name, product_description, price, availability) VALUES($1, $2, $3, $4) RETURNING *",
            [product_name, product_description, price, availability]
        );

        // Get the ID of the newly created product
        const productId = newProduct.rows[0].product_id;

         // Insert the image data into the database using the product_id as the reference of the associated product
    await pool.query(
        "INSERT INTO images (filename, filepath, mimetype, size, product_id) VALUES ($1, $2, $3, $4, $5)",
        [filename, filepath, mimetype, size, productId]
      );

      // Return the newly created product as the response
    res.status(201).json(newProduct.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server Error" });
    }
    
});

// GET all products with associated image filename
app.get("/api/v1/getproduct", async (req, res) => {
    try {
      const getProducts = await pool.query(`
      SELECT
      product.product_id,
      product.product_name,
      product.product_description,
      product.price,
      product.availability,
      images.filename AS product_image_filename
    FROM
      product
    LEFT JOIN
      images ON product.product_id = images.product_id
      `);
      res.json(getProducts.rows);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  });

//GET a Product with its id together with its associated image
// GET a product.image using the image filename
app.get("/api/v1/getproduct/:product_id", async (req, res) => {
    try {
      const { product_id } = req.params;
  
      // Fetch product details along with the associated image filename
      const getProduct = await pool.query(
        `SELECT
           p.product_id,
           p.product_name,
           p.product_description,
           p.price,
           p.availability,
           i.filename AS product_image_filename
         FROM
           product p
         LEFT JOIN
           images i ON p.product_id = i.product_id
         WHERE
           p.product_id = $1`,
        [product_id]
      );
  
      if (getProduct.rows.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
  
      res.status(200).json(getProduct.rows[0]);
    } catch (error) {
      console.error("Error getting product:", error.message);
      res.status(500).json({ message: "Server Error" });
    }
  });

//UPDATE a product entry through its ID
app.put("http://localhost:5000/api/v1/updateproduct/:product_id", async (req,res) => {
    try {
        const{product_id} = req.params;
        const {product_name, product_description, price, availability} = req.body;
        const updateProduct = await pool.query(
            "UPDATE product SET product_name =$1, product_description =$2, price =$3, availability =$4 WHERE product_id =$5",
            [product_name, product_description, price, availability, product_id]
        );
        res.json({message:"Updated a product"});
    } catch (error) {
        console.error(error.message);
    }
    
});

//DELETE a product entry
app.delete("/api/v1/deleteproduct/:product_id", async (req, res) =>{``
    try {
        const { product_id } =req.params;
        await pool.query(
            "DELETE FROM orders WHERE product_id =$1",[product_id]
        );
        await pool.query(
            "DELETE FROM images WHERE product_id =$1",[product_id]
        );
        await pool.query(
            "DELETE FROM payment WHERE product_id =$1",[product_id]
        );
        const deleteProduct = await pool.query(
            "DELETE FROM product WHERE product_id =$1",
            [product_id]
        );

        res.json({message:"Deleted an product"})
    } catch (error) {
        console.error(error.message);
    }
});

// UPLOAD a Product image
app.post("/api/v1/uploadproductimage", upload.single("image"), async (req, res) => {
      // console.log(req);
      // return 0;
      try {
        console.log(req);
        const { product_id } = req.body;
        const { filename, path: filepath, mimetype, size } = req.file;
        const newImage = await pool.query(
          "INSERT INTO images (filename, filepath, mimetype, size, product_id) VALUES($1, $2, $3, $4, $5) RETURNING *",
          [filename, filepath, mimetype, size, product_id]
        );
  
        console.log(res.json(newImage.rows));
      } catch (error) {
        console.error(error.message);
      }
    }
  );

  // GET an image
app.get("/api/v1/getproductimage/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(__dirname, "public/image/", filename);
  
      res.sendFile(filePath);
    } catch (error) {
      console.error(error.message);
    }
  });

//create a NEW user
app.post("/api/v1/userssignup", async (req, res) => {
    try {
      // Extract username and password from request body
      const { users_firstname, users_lastname,users_contact, users_email, password_hash, username } = req.body;

      // Hash the password
    const hashedPassword = await bcrypt.hash(password_hash, 10);
  
      // Check if username already exists
      const userExists = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
      );
  
      if (userExists.rows.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }
  
      // Insert new user into the database
      const newUser = await pool.query(
        "INSERT INTO users (users_firstname, users_lastname,users_contact, users_email, password_hash, username) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [users_firstname, users_lastname,users_contact, users_email, hashedPassword, username]
      );
  
      res.status(201).json(newUser.rows[0]);
  
      // Get the newly created user's ID
      const userId = newUser.rows[0].users_id;

       // Get the ID of the default user role (assuming it's stored in the roles table)
    const defaultUserRole = await pool.query(
        "SELECT roles_id FROM roles WHERE role_name = 'user'"
      );
  
      // Assign the default role to the user
      await pool.query(
        "INSERT INTO users_roles (users_id, roles_id) VALUES ($1, $2)",
        [userId, defaultUserRole.rows[0].roles_id]
      );
      

       // Generate JWT token
    //const token = generateToken(user);
  
    res.status(201).json({ user});
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

// login API
app.post("/api/v1/userslogin", async (req, res) => {
    try {
      // Extract username and password from request body
      const { username, password } = req.body;
  
      // Check if user exists
      const user = await pool.query(
        `SELECT users.users_id, users.username, users.password_hash, roles.role_name AS role
         FROM users
         INNER JOIN users_roles ON users.users_id = users_roles.users_id
         INNER JOIN roles ON users_roles.roles_id = roles.roles_id
         WHERE users.username = $1`,
        [username]
      );

      // fetch product details
      {/*const product = await pool.query(
        `SELECT product.users_id, users.username, users.password_hash, roles.role_name AS role
         FROM users
         INNER JOIN users_roles ON users.users_id = users_roles.users_id
         INNER JOIN roles ON users_roles.roles_id = roles.roles_id
         WHERE users.username = $1`,
        [username]
      );*/}
  
      if (user.rows.length === 0) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Compare hashed passwords
    const hashedPasswordFromDB = user.rows[0].password_hash;
    const isPasswordMatch = await bcrypt.compare(
      password,
      hashedPasswordFromDB
    );
    console.log(isPasswordMatch)

    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    // At this point, authentication is successful
    // Generate JWT token with user ID and role
    const token = jwt.sign(
        { userId: user.rows[0].users_id, role: user.rows[0].role },
        "secretKey",
        { expiresIn: "1h" }
      );
  
      // Return userID, username, role, and token
      res.status(200).json({
        userId: user.rows[0].users_id,
        username: user.rows[0].username,
        role: user.rows[0].role,
        token,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Internal server error"});
  }
  });

//get all Users
app.get("/api/v1/getusers", async(req, res) => {
    try {
        const getUsers = await pool.query("SELECT * FROM users");
        res.json(getUsers.rows);
    } catch (error) {
        console.error(error.message);
    }
});

//Get user's data using their ID
app.get("/api/v1/getusers/:users_id", async(req, res) =>{
    try {
        const {users_id}= req.params;
        const getUsers = await pool.query(
            "SELECT * FROM users where users_id = $1",
            [users_id]
        );
       // Check if user with the specified ID exists
    if (user.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.status(200).json(user.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
});

//UPDATE a user's data through its ID
app.put("/api/v1/updateusers/:users_id", async (req,res) => {
    const{users_id} = req.params.id;
    try {
        const {users_firstname, users_lastname, users_contact, users_email, password_hash, username} = req.body;
        const updateUsers = await pool.query(
            "UPDATE users SET users_firstname =$1, users_lastname =$2, users_contact =$3, users_email =$4, password_hash =$5, username =$6 WHERE users_id =$7",
            [users_firstname, users_lastname, users_contact, users_email, password_hash, username, users_id]
        );
        res.json({message:"User details updated successfully"});
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Server Error" });
    }
    
});

//DELETE a user's entry
app.delete("/api/v1/deleteusers/:users_id", async (req, res) =>{
    try {
        const { users_id } =req.params;

        await pool.query(
            "DELETE FROM orders WHERE users_id =$1",[users_id]
        );
        await pool.query(
            "DELETE FROM users_roles WHERE users_id =$1",[users_id]
        );
        const deleteUsers = await pool.query(
            "DELETE FROM users WHERE users_id =$1",
            [users_id]
        );

        res.json({message:"Deleted a user"})
    } catch (error) {
        console.error(error.message);
    }
});

// Roles API endpoints
// GET all roles
app.get('/api/v1/getroles', async (req, res) => {
    try {
      const roles = await pool.query('SELECT * FROM roles');
      res.json(roles.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error' });
    }
  });
  
  // POST a new role
  app.post('/api/v1/createroles', async (req, res) => {
    const { role_name, role_description } = req.body;
    try {
      const newRole = await pool.query(
        'INSERT INTO roles (role_name, role_description) VALUES ($1, $2) RETURNING *',
        [role_name, role_description]
      );
      res.status(201).json(newRole.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error'});
  }
  });

  // Update user roles by user ID
app.put("/api/v1/user-roles/:userId", async (req, res) => {
    const usersId = req.params.userId;
    const { rolesId } = req.body;
  
    try {
      // Delete existing user roles
      await pool.query("DELETE FROM user_roles WHERE users_id = $1", [usersId]);
  
      // Insert new user roles
      const values = rolesId.map((roleId) => [usersId, roleId]);
      if (values.length > 0) {
        await pool.query(
          "INSERT INTO users_roles (users_id, roles_id) VALUES ($1, $2)",
          values
        );
      }
  
      res.status(200).json({ message: "User roles updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  });

  // Delete user roles by user ID
app.delete("/api/v1/user-roles/:userId", async (req, res) => {
    const usersId = req.params.userId;
  
    try {
      // Delete user roles by user ID
      await pool.query("DELETE FROM users_roles WHERE users_id = $1", [usersId]);
  
      res.status(200).json({ message: "User's role deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  });

  
  
  
//create an order entry
app.post("/api/v1/orders", verifyToken, async (req,res) => {
    try {
        const{start_date, end_date, product_id} = req.body;
        const users_id = req.userId;//extract the users_id from the verified token middleware
        const newOrders = await pool.query(
            "INSERT INTO orders (start_date, end_date, users_id, product_id) VALUES($1, $2, $3, $4) RETURNING *",
            [start_date, end_date, users_id, product_id]
        );
        res.json(newOrders.rows);
    } catch (error) {
        console.error(error.message);
    }
    
});

//get all Orders
app.get("/api/v1/getorders", async(req, res) => {
    try {
        const getOrders = await pool.query(`
        select
          orders.order_id,
          orders.start_date,
          orders.end_date,
          product.price,
          users.username,
          orders.product_id,
          orders.users_id
          from orders
          join product on product.product_id = orders.product_id
          JOIN users on orders.users_id = users.users_id;`);
        res.json(getOrders.rows);
    } catch (error) {
        console.error(error.message);
    }
});

//get an order with its ID
app.get("/api/v1/getorders/:order_id", async(req, res) =>{
    try {
        const {order_id} =req.params;
        const getOrders = await pool.query(
            "SELECT * FROM orders WHERE order_id =$1",
            [order_id]
        );
        res.json(getOrders.rows);
    } catch (error) {
        console.error(error.message);
    }
});

//get an order using a user's ID
app.get("/api/v1/getorders/users/:users_id", verifyToken, async(req, res) =>{
    try {
        const userId =req.params.users_id;
        const getOrders = await pool.query(
            `SELECT 
            orders.order_id,
            product.product_name,
            product.product_description,
            orders.start_date,
            orders.end_date,
            product.price,
            images.filename
            FROM product
            JOIN orders ON product.product_id = orders.product_id
            JOIN images ON product.product_id = images.product_id
            where orders.users_id = $1;`,
            [userId]
        );
        res.json(getOrders.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Internal server error" }); // Return an error response
    }
});

//Update order data through its ID
app.put("/api/v1/updateorders/:order_id", async(req,res) =>{
    try {
        const {order_id} =req.params;
        const {price, start_date, end_date, status, users_id, product_id} =req.body;
        const updateOrders = await pool.query(
            "UPDATE orders SET price =$1, start_date =$2, end_date =$3, status =$4, users_id =$5, product_id =$6 WHERE order_id =$7",
            [price, start_date, end_date, status, users_id, product_id, order_id]
        );
        res.json({message:"Updated an Order"});
    } catch (error) {
        console.error(error.message);
    }
});

//DELETE an order entry
app.delete("/api/v1/deleteorders/:order_id", async (req, res) =>{
    try {
        const { order_id } =req.params;
        const deleteOrder = await pool.query(
            "DELETE FROM orders WHERE order_id =$1",
            [order_id]
        );

        res.json({message:"Deleted an order"})
    } catch (error) {
        console.error(error.message);
    }
});

//create a payment entry
app.post("/api/v1/payment", async (req,res) => {
    try {
        const{order_id, users_id, product_id, payment_date, amount, status, payment_mode, reference_number} = req.body;
        const newPayment = await pool.query(
            "INSERT INTO payment (order_id, users_id, product_id, payment_date, amount, status, payment_mode, reference_number) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
            [order_id, users_id, product_id, payment_date, amount, status, payment_mode, reference_number]
        );
        res.json(newPayment.rows);
    } catch (error) {
        console.error(error.message);
    }
    
});

//get all Payment records
app.get("/api/v1/getpayment", async(req, res) => {
    try {
        const getPayment = await pool.query("SELECT * FROM payment");
        res.json(getPayment.rows);
    } catch (error) {
        console.error(error.message);
    }
});

//get a payment entry with its ID
app.get("/api/v1/getpayment/:payment_id", async(req, res) =>{
    try {
        const {payment_id}= req.params;
        const getPayment = await pool.query(
            "SELECT * FROM payment WHERE payment_id =$1",
            [payment_id]
        );
        res.json(getPayment.rows);
    } catch (error) {
        console.error(error.message);
    }
});

//UPDATE a payment's data through its ID
app.put("/api/v1/updatepayment/:payment_id", async (req,res) => {
    try {
        const{payment_id} = req.params;
        const {order_id, users_id, product_id, payment_date, amount, status, payment_mode, reference_number} = req.body;
        const updatePayment = await pool.query(
            "UPDATE payment SET order_id =$1, users_id =$2,product_id =$3, payment_date =$4, amount =$5, status =$6, payment_mode =$7, reference_number =$8 WHERE payment_id =$9",
            [order_id, users_id, product_id, payment_date, amount, status, payment_mode, reference_number, payment_id]
        );
        res.json({message:"Updated a payment entry"});
    } catch (error) {
        console.error(error.message);
    }
    
});

//DELETE a payment entry
app.delete("/api/v1/deletepayment/:id", async (req, res) =>{
    try {
        const { payment_id } =req.params;
        const deletePayment = await pool.query(
            "DELETE FROM payment WHERE payment_id =$1",
            [payment_id]
        );

        res.json({message:"Deleted a payment entry"})
    } catch (error) {
        console.error(error.message);
    }
});


app.listen(5000, () =>{
    console.log("listening on port 5000");
});
