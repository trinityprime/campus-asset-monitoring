// Configuration
const poolData = {
  UserPoolId: "us-east-1_9jBRbvy4K",
  ClientId: "2ln0cuq94e7ckjo0ira0qqod5u",
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
const backendUrl = "http://34.227.53.47:3000";

// --- REGISTER ---
function register() {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "email",
      Value: email,
    }),
  ];

  userPool.signUp(username, password, attributeList, null, (err, result) => {
    if (err) return alert(err.message);
    alert("Registered! Check your email for the verification link/code.");
  });
}

// --- LOGIN ---
function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: username,
    Password: password,
  });

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: username,
    Pool: userPool,
  });

  cognitoUser.authenticateUser(authDetails, {
    onSuccess: (result) => {
      console.log("Logged in!");
      checkAuth();
    },
    onFailure: (err) => alert(err.message),
  });
}

// --- CHECK AUTH & GET TOKEN ---
function checkAuth() {
  const cognitoUser = userPool.getCurrentUser();
  const reportCard = document.getElementById("reportCard");
  const logoutBtn = document.getElementById("logoutBtn");

  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (session && session.isValid()) {
        reportCard.style.display = "block";
        logoutBtn.classList.remove("d-none");
      }
    });
  } else {
    reportCard.style.display = "none";
    logoutBtn.classList.add("d-none");
  }
}

// --- SUBMIT REPORT ---
document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cognitoUser = userPool.getCurrentUser();

  if (!cognitoUser) return alert("Please login first");

  cognitoUser.getSession(async (err, session) => {
    const token = session.getIdToken().getJwtToken(); // GET TOKEN
    const formData = new FormData(e.target);

    try {
      const res = await fetch(`${backendUrl}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        alert("Reported!");
        loadIssues();
      }
    } catch (err) {
      alert("Error connecting to server");
    }
  });
});

function logout() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) cognitoUser.signOut();
  checkAuth();
}

// Initialize
checkAuth();
