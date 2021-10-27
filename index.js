const admin = require("firebase-admin");
const { ApolloServer, gql } = require("apollo-server");

const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const typeDefs = gql`
  type User {
    id: String
    firstName: String
    lastName: String
    favoriteCollections: [String]
  }

  type CollectionType {
    name: String
    id: String
  }

  type Collection {
    id: String
    name: String
    type: String
    detail: String
  }

  type MutationResult {
    success: Boolean
  }

  type Query {
    user(id: String): User
    collectionTypes: [CollectionType]
    collections(type: String): [Collection]
    favoriteCollections(userId: String): [Collection]
  }

  type Mutation {
    addFavoriteCollection(userId: String, collectionId: String): MutationResult
    removeFavoriteCollection(
      userId: String
      collectionId: String
    ): MutationResult
  }
`;

const resolvers = {
  Query: {
    user: async (_, { userId }) => {
      return await fetchUserData(userId);
    },
    collectionTypes: async () => {
      return await fetchAllCollectionTypes();
    },
    collections: async (_, { type }) => {
      return await fetchCollectionsByType(type);
    },
    favoriteCollections: async (_, { userId }) => {
      return await fetchFavoritesCollections(userId);
    },
  },
  Mutation: {
    addFavoriteCollection: async (_, { userId, collectionId }) => {
      return await addFavorite(userId, collectionId);
    },
    removeFavoriteCollection: async (_, { userId, collectionId }) => {
      return await removeFavorite(userId, collectionId);
    },
  },
};

const fetchAllCollectionTypes = async () => {
  const items = await db.collection("collectionTypes").get();
  const results = [];
  items.docs.forEach((doc) => {
    const original = doc.data();
    original.id = doc.id;
    results.push(original);
  });
  return results;
};

const fetchUserData = async (userId) => {
  const user = await db.collection("users").doc(userId).get();
  const result = user.data();
  result.id = user.id;
  return result;
};

const fetchCollectionsByType = async (type) => {
  const collections = await db
    .collection("collections")
    .where("type", "==", type)
    .get();
  const results = [];
  collections.forEach((doc) => {
    const original = doc.data();
    original.id = doc.id;
    results.push(original);
  });
  return results;
};

const fetchFavoritesCollections = async (userId) => {
  const userData = (await db.collection("users").doc(userId).get()).data();
  const favoriteCollections = userData.favoriteCollections;
  if (!favoriteCollections.length) {
    return [];
  }
  const collections = await db
    .collection("collections")
    .where("__name__", "in", favoriteCollections)
    .get();
  const results = [];
  collections.forEach((doc) => {
    const original = doc.data();
    original.id = doc.id;
    results.push(original);
  });
  return results;
};

const addFavorite = async (userId, collectionId) => {
  try {
    await db
      .collection("users")
      .doc(userId)
      .update({
        favoriteCollections:
          admin.firestore.FieldValue.arrayUnion(collectionId),
      });
    return { success: true };
  } catch {
    return { success: false };
  }
};

const removeFavorite = async (userId, collectionId) => {
  try {
    await db
      .collection("users")
      .doc(userId)
      .update({
        favoriteCollections:
          admin.firestore.FieldValue.arrayRemove(collectionId),
      });
    return { success: true };
  } catch {
    return { success: false };
  }
};

const server = new ApolloServer({
  cors: {
    origin: "*",
    credentials: true,
  },
  typeDefs,
  resolvers,
});

server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
