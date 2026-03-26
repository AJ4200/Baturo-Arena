import { AiOutlineLoading3Quarters } from "react-icons/ai";

type AppLoaderProps = {
  active: boolean;
  subtle?: boolean;
};

export function AppLoader({ active, subtle = false }: AppLoaderProps) {
  if (!active) {
    return null;
  }

  return (
    <div className={subtle ? "app-loader-corner" : "app-loader-overlay"}>
      <div className={subtle ? "app-loader-card app-loader-card-subtle" : "app-loader-card"}>
        <AiOutlineLoading3Quarters className="loader-spin" />
        <span>Syncing</span>
      </div>
    </div>
  );
}
