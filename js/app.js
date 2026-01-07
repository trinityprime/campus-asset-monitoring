const poolData = {
  UserPoolId: "us-east-1_9jBRbvy4K",
  ClientId: "2ln0cuq94e7ckjo0ira0qqod5u",
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
const backendUrl = "http://campus-issues.duckdns.org:3000";

let authModal;

document.addEventListener("DOMContentLoaded", () => {
  authModal = new bootstrap.Modal(document.getElementById("authModal"));
});

function checkUserIsAdmin() {
  const user = userPool.getCurrentUser();
  if (!user) return false;

  const storageKey = `CognitoIdentityServiceProvider.${poolData.ClientId}.${user.username}.idToken`;
  const idToken = localStorage.getItem(storageKey);
  if (!idToken) return false;

  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    const groups = payload["cognito:groups"] || [];
    return groups.includes("Admin");
  } catch (e) {
    return false;
  }
}

function handleReportClick() {
  const cognitoUser = userPool.getCurrentUser();

  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        authModal.show();
      } else {
        const reportCard = document.getElementById("reportCard");
        reportCard.classList.remove("hidden");
        reportCard.scrollIntoView({ behavior: "smooth" });
      }
    });
  } else {
    authModal.show();
  }
}

function register() {
  const username = document.getElementById("regUsername").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;

  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "email",
      Value: email,
    }),
  ];

  userPool.signUp(username, password, attributeList, null, (err, result) => {
    if (err) return alert(err.message);

    document.getElementById("registerSection").classList.add("hidden");
    document.getElementById("verifySection").classList.remove("hidden");
    alert("Code sent to " + email);
  });
}

function confirmRegistration() {
  const username = document.getElementById("regUsername").value;
  const code = document.getElementById("verifyCode").value;

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: username,
    Pool: userPool,
  });

  cognitoUser.confirmRegistration(code, true, (err, result) => {
    if (err) return alert(err.message);
    alert("Verified! You can now sign in.");
    toggleAuth(false);
  });
}

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
      authModal.hide();
      checkAuth();

      if (checkUserIsAdmin()) {
        document
          .querySelectorAll(".admin-panel")
          .forEach((p) => p.classList.remove("hidden"));
      }

      document.getElementById("reportCard").classList.remove("hidden");
    },
    onFailure: (err) => alert(err.message),
  });
}

function checkAuth() {
  const cognitoUser = userPool.getCurrentUser();
  const logoutBtn = document.getElementById("logoutBtn");
  const userWelcome = document.getElementById("userWelcome");

  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (session && session.isValid()) {
        logoutBtn.classList.remove("hidden");

        if (userWelcome) {
          userWelcome.textContent = `Welcome, ${cognitoUser.getUsername()}`;
          userWelcome.classList.remove("hidden");
        }
      } else {
        showLoggedOutState();
      }
    });
  } else {
    showLoggedOutState();
  }
}

function showLoggedOutState() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.classList.add("hidden");
  const userWelcome = document.getElementById("userWelcome");
  if (userWelcome) userWelcome.classList.add("hidden");
}

async function updateStatus(issueId, newStatus) {
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) return;

  cognitoUser.getSession(async (err, session) => {
    if (err) return alert("Session expired.");

    const token = session.getIdToken().getJwtToken();

    try {
      const res = await fetch(`${backendUrl}/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const badge = document.getElementById(`badge-${issueId}`);
        if (badge) {
          badge.textContent = newStatus;
          badge.className =
            "badge rounded-pill border " +
            (newStatus === "Resolved"
              ? "bg-success text-white"
              : newStatus === "In Progress"
              ? "bg-warning text-dark"
              : "bg-light text-dark");
        }
      } else {
        alert("Update failed. Admins only.");
      }
    } catch (err) {
      console.error(err);
    }
  });
}

async function loadIssues() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    let issues = await res.json();

    const isAdmin = checkUserIsAdmin();
    const filterValue = document.getElementById("categoryFilter").value;

    if (filterValue) {
      issues = issues.filter(
        (i) => i.category.toLowerCase() === filterValue.toLowerCase()
      );
    }

    const container = document.getElementById("issues");
    if (issues.length === 0) {
      container.innerHTML =
        "<p class='text-center mt-5 text-muted'>No issues reported in this category.</p>";
      return;
    }

    container.innerHTML = issues
      .map((issue) => {
        const currentStatus = issue.status || "New";

        // Persisting Colors logic
        let badgeClass = "bg-light text-dark";
        if (currentStatus === "In Progress")
          badgeClass = "bg-warning text-dark";
        if (currentStatus === "Resolved") badgeClass = "bg-success text-white";

        // Date Formatting (Using createdAt from DynamoDB)
        const datePosted = issue.createdAt
          ? new Date(issue.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Recently";

        const adminControls = `
                <div class="admin-panel ${
                  isAdmin ? "" : "hidden"
                } mt-3 pt-3 border-top">
                    <label class="small fw-bold text-muted d-block mb-1">Admin Status Update:</label>
                    <select class="form-select form-select-sm" onchange="updateStatus('${
                      issue.issueId
                    }', this.value)">
                        <option value="New" ${
                          currentStatus === "New" ? "selected" : ""
                        }>New</option>
                        <option value="In Progress" ${
                          currentStatus === "In Progress" ? "selected" : ""
                        }>In Progress</option>
                        <option value="Resolved" ${
                          currentStatus === "Resolved" ? "selected" : ""
                        }>Resolved</option>
                    </select>
                </div>
            `;

        return `
            <div class="col-md-4 mb-4">
                <div class="card h-100 card-shadow border-0">
                    <img src="${issue.imageUrl}" class="card-img-top" alt="Issue">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-soft-primary text-primary text-capitalize">${issue.category}</span>
                            <small class="text-muted" style="font-size: 0.75rem;">${datePosted}</small>
                        </div>
                        <p class="card-text fw-bold mb-1">${issue.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">📍 ${issue.location}</small>
                            <span id="badge-${issue.issueId}" class="badge rounded-pill border ${badgeClass}">
                                ${currentStatus}
                            </span>
                        </div>
                        ${adminControls}
                    </div>
                </div>
            </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cognitoUser = userPool.getCurrentUser();

  cognitoUser.getSession(async (err, session) => {
    if (err) return authModal.show();

    const token = session.getIdToken().getJwtToken();
    const formData = new FormData(e.target);

    try {
      const res = await fetch(`${backendUrl}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        alert("Thank you! Report submitted.");
        e.target.reset();
        document.getElementById("reportCard").classList.add("hidden");
        loadIssues();
      }
    } catch (err) {
      alert("Connection error.");
    }
  });
});

function logout() {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
  window.location.reload();
}

document
  .getElementById("categoryFilter")
  .addEventListener("change", loadIssues);
checkAuth();
loadIssues();
