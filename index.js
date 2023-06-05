const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log("auth", authorization);
  if (!authorization) {
    return res.status(403).send({ error: true, message: "forbidden Access" });
  }
  // bearar token
  const token = authorization.split(" ")[1];
  console.log("token", token);
  console.log("token1", process.env.ACCESS_TOKEN);
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

// mongo db

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p9nxh9h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // TODO: have to be remove below line
    await client.connect();

    const allMenuCollection = client.db("bistroBoss").collection("foodItems");
    const usersCollection = client.db("bistroBoss").collection("users");
    const allReviews = client.db("bistroBoss").collection("bistroBossReviews");
    const cartItems = client.db("bistroBoss").collection("cartItems");

    // handle JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign({email: user.user.email}, process.env.ACCESS_TOKEN);
      res.send({ token });
    });

 
    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // user related api
    //------------------------------------------------------
    // post users to db
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ Message: "User Already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // security layer: verifyJWT
    // email same
    // check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //  make admin a spesific user
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // menu related apis
    // --------------------------------------------------------------

    // get all menu items
    app.get("/allmenu", async (req, res) => {
      const result = await allMenuCollection.find().toArray();
      res.send(result);
    });

    // insert a item to cart
    app.post("/cart", async (req, res) => {
      const cartBody = req.body;
      console.log(cartBody)
      const result = await cartItems.insertOne(cartBody);
      res.send(result);
    });

    // get cart items
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email)
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
     console.log(req.decoded)
      if (email !== decodedEmail) {
        return res
          .status(401).send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await cartItems.find(query).toArray();
      res.send(result);
    });

    // delete cart item api
    app.delete("/item/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartItems.deleteOne(query);
      res.send(result);
    });

    // reviews api
    // ------------------------------------------------

    // get all reviews
    app.get("/reviews", async (req, res) => {
      const result = await allReviews.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
