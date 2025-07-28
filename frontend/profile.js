document.addEventListener("DOMContentLoaded", async () => {
  // First, require auth before doing anything
  await requireAuth();

  // Load the user's profile data
  await loadUserProfile();

  showStatusBarBackButton(() => {
      window.location.replace("chat.html");
  });
  // Attach button events
  document.getElementById("logout-btn").addEventListener("click", logoutUser);
  document.getElementById("edit-btn").addEventListener("click", () => toggleEditMode(true));
  document.getElementById("cancel-btn").addEventListener("click", () => toggleEditMode(false));
  document.getElementById("save-btn").addEventListener("click", updateProfile);
});

// A store for the original data to revert on cancel
let originalProfileData = {};

function toggleEditMode(isEditing) {
  const form = document.getElementById("profile-form");
  const fields = ['profile-display-name', 'profile-username', 'profile-bio'];

  fields.forEach(id => {
    const element = document.getElementById(id);
    if (isEditing) {
      // Store original values before enabling edit
      originalProfileData[id] = element.value;
      element.readOnly = false;
    } else {
      // Restore original values on cancel
      element.value = originalProfileData[id] || '';
      element.readOnly = true;
    }
  });

  // Toggle button visibility
  document.getElementById("edit-btn").style.display = isEditing ? "none" : "block";
  document.getElementById("save-btn").style.display = isEditing ? "block" : "none";
  document.getElementById("cancel-btn").style.display = isEditing ? "block" : "none";
}

async function loadUserProfile() {
  const token = getCookie("auth_token");
  if (!token) return;

  try {
    // YOU WILL NEED TO CREATE 'get_profile.php' on your backend
    const res = await fetch(API + "fetch_profile.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById("profile-display-name").value = data.user.display_name;
      document.getElementById("profile-username").value = data.user.username;
      document.getElementById("profile-email").value = data.user.email;
      document.getElementById("profile-bio").value = data.user.bio;
    } else {
      alert("Could not load profile data.");
    }
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

async function updateProfile() {
  const token = getCookie("auth_token");
  
  const updatedData = {
    token: token,
    display_name: document.getElementById("profile-display-name").value,
    username: document.getElementById("profile-username").value,
    bio: document.getElementById("profile-bio").value
  };

  try {
    // YOU WILL NEED TO CREATE 'update_profile.php' on your backend
    const res = await fetch(API + "update_profile.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData)
    });

    const result = await res.json();

    if (result.success) {
      alert("Profile updated successfully!");
      toggleEditMode(false); // Exit edit mode
      await loadUserProfile(); // Reload data to confirm
    } else {
      alert("Update failed: " + (result.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Update error:", err);
  }
}

function logoutUser() {
  if (confirm("Do you really want to logout?")) {
    deleteCookie("auth_token");
    window.location.replace("login.html");
  }
}
