import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const plannetBattle = await deploy("PlanetBattle", {
    from: deployer,
    log: true,
  });

  console.log(`Plannet Battle contract Address: `, plannetBattle.address);

};
export default func;
func.id = "deploy_PlannetBattleGame"; // id required to prevent reexecution
func.tags = ["PlannetBattle"];
