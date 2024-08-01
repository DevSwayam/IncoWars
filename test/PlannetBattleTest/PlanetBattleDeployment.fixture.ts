import { PlanetBattle } from "../../types";
import { getSigners } from "../signers";
import { ethers } from "hardhat";

export async function planetBattleDeploymentFixture(): Promise<[PlanetBattle]> {

  console.log("------------------------------------------------------------------");
  console.log("Deploying Plannet Battle Contract...");

  const signers = await getSigners();
  const PlanetBattleFactory = await ethers.getContractFactory("PlanetBattle");
  const PlanetBattleContract = await PlanetBattleFactory.connect(signers.alice).deploy();
  await PlanetBattleContract.waitForDeployment(); 
  const PlanetBattleContractAddress = await PlanetBattleContract.getAddress();
  console.log("Plannet Battle Contract Address is: ", PlanetBattleContractAddress);
  return [PlanetBattleContract]; // Return as a tuple.
}
