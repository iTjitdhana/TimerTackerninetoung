import { useState } from "react";
import {
  LoginPage,
  RegisterPage,
  type AuthenticatedUser,
} from "../src/index";

const ASSETS = {
  logo: "/jitdhana-logo.png",
  background: "/jitdhana-building.jpg",
};

type Page = "login" | "register";

export function App() {
  const [page, setPage] = useState<Page>("login");

  const branding = {
    logoUrl: ASSETS.logo,
    backgroundImageUrl: ASSETS.background,
  };

  const handleLoginSuccess = (user: AuthenticatedUser) => {
    setTimeout(() => {
      alert(
        `Demo: redirect ไป Portal\nrole = ${user.role}\nuser = ${user.name}`
      );
    }, 600);
  };

  if (page === "register") {
    return (
      <RegisterPage
        {...branding}
        onLoginClick={() => setPage("login")}
        onSuccess={() => setTimeout(() => setPage("login"), 1200)}
      />
    );
  }

  return (
    <LoginPage
      {...branding}
      onRegisterClick={() => setPage("register")}
      onSuccess={handleLoginSuccess}
    />
  );
}
