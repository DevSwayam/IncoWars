import { assert, expect } from "chai";
import { ethers } from "hardhat";

import { awaitAllDecryptionResults } from "../asyncDecrypt";
import { createInstances, decrypt64 } from "../instance";
import { getSigners, initSigners } from "../signers";
import { planetBattleDeploymentFixture } from "./PlanetBattleDeployment.fixture";

describe("Casino Tests", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const [planetBattleContract] = await planetBattleDeploymentFixture();
    this.planetBattle = planetBattleContract;
    this.instances = await createInstances(this.signers);
  });

  it("Both should be able to capture planets and then reveal there attacking, defense power and energy generation rate", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);
    const bobPlanetBattle = await this.planetBattle.connect(this.signers.bob);
    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    await createTx.wait();

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    console.log("---------------------------------------");

    const joinTx = await bobPlanetBattle.joinBattle(keyword, { gasLimit: 4000000 });
    await joinTx.wait();

    await awaitAllDecryptionResults();
    await new Promise((res) => setTimeout(() => res(null), 5000));

    const battleAfterJoin = await bobPlanetBattle.battles(keyword);
    console.log("Battle Details after Joining:", battleAfterJoin);

    // To check whether the planets which have been captured till now has received currect ranomNumber or not
    let planetIds = [];

    console.log("---------------------------------------");
    console.log("Alice Turn To Capture Planets");
    // Alice Capturing Planets
    const universeAliceContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.alice,
    );
    // Retrieve initial energy available for Alice's home planet (assuming it's planet with ID 0)
    let alicePlayerInfo = await universeAliceContract.playerAddressToPlayerInfo(this.signers.alice.address);
    let AliceHomePlanetEnergy = alicePlayerInfo.initialEnergy;

    for (let i = 1; i <= 8; i++) {
      const planet = await universeAliceContract.planets(i);
      console.log("Checking Planet", i, ":", planet);

      if (planet.owner === ethers.ZeroAddress) {
        // Calculate required energy assuming distance affects energy needed linearly
        const distance = await universeAliceContract.calculateDistance(
          alicePlayerInfo.homeCoordinateX,
          alicePlayerInfo.homeCoordinateY,
          planet.x,
          planet.y,
        );
        const requiredEnergy = planet.baseEnergy * distance;

        console.log(`energy to capture planet ${i}. Required: ${requiredEnergy}, Available: ${AliceHomePlanetEnergy}`);

        if (AliceHomePlanetEnergy >= requiredEnergy) {
          console.log("Capturing Planet", i);
          const captureTx = await universeAliceContract.attackPlanet(0, i, { gasLimit: 1000000 });
          await captureTx.wait();

          // Update home planet energy after the capture attempt
          AliceHomePlanetEnergy -= requiredEnergy;

          const planetAfterCapture = await universeAliceContract.planets(i);
          console.log("Planet", i, "after capture:", planetAfterCapture);
          planetIds.push(i);
        } else {
          console.log(
            `Not enough energy to capture planet`,
          );
        }
      }
    }
    console.log("---------------------------------------");
    console.log("Bob's Turn to Capture Planets");
    // Bob Capturing planets
    const universeBobContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.bob,
    );

    // Retrieve initial energy available for Alice's home planet (assuming it's planet with ID 0)
    let bobPlayerInfo = await universeBobContract.playerAddressToPlayerInfo(this.signers.bob.address);
    let bobHomePlanetEnergy = bobPlayerInfo.initialEnergy;

    for (let i = 1; i <= 8; i++) {
      const planet = await universeBobContract.planets(i);
      console.log("Checking Planet", i, ":", planet);

      if (planet.owner === ethers.ZeroAddress) {
        // Calculate required energy assuming distance affects energy needed linearly
        const distance = await universeBobContract.calculateDistance(
          bobPlayerInfo.homeCoordinateX,
          bobPlayerInfo.homeCoordinateY,
          planet.x,
          planet.y,
        );
        const requiredEnergy = planet.baseEnergy * distance;

        console.log(`Energy required to capture planet ${i}: ${requiredEnergy}`);

        if (bobHomePlanetEnergy >= requiredEnergy) {
          console.log("Capturing Planet", i);
          const captureTx = await universeBobContract.attackPlanet(0, i, { gasLimit: 1000000 });
          await captureTx.wait();

          // Update home planet energy after the capture attempt
          bobHomePlanetEnergy -= requiredEnergy;

          const planetAfterCapture = await universeBobContract.planets(i);
          console.log("Planet", i, "after capture:", planetAfterCapture);
          planetIds.push(i);
        } else {
          console.log(
            `Not enough energy to capture planet ${i}. Required: ${requiredEnergy}, Available: ${bobHomePlanetEnergy}`,
          );
        }
      }
    }

    // wait for all decryption Results
    await awaitAllDecryptionResults();

    for (let i = 0; i < planetIds.length; i++) {
      const planetInfo = await universeBobContract.planets(planetIds[i]);
      if(planetInfo.owner === this.signers.alice.address){
        console.log("this Planet Was captured by Alice")
        console.log("Attacking Power is : ", planetInfo.attackingPower);
        console.log("Defense Power is : ", planetInfo.defensePower);
        console.log("Energy Generation Rate is : ", planetInfo.energyGenerationRate);
        console.log("---------------------------------------");
      }else{
        console.log("this Planet Was captured by Bob")
        console.log("Attacking Power is : ", planetInfo.attackingPower);
        console.log("Defense Power is : ", planetInfo.defensePower);
        console.log("Energy Generation Rate is : ", planetInfo.energyGenerationRate);
        console.log("---------------------------------------");
      }

    }
  });

  it("Both Alice and Bob should be able to capture planets ", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);
    const bobPlanetBattle = await this.planetBattle.connect(this.signers.bob);
    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    await createTx.wait();

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    const joinTx = await bobPlanetBattle.joinBattle(keyword, { gasLimit: 4000000 });
    await joinTx.wait();

    await awaitAllDecryptionResults();
    await new Promise((res) => setTimeout(() => res(null), 5000));

    const battleAfterJoin = await bobPlanetBattle.battles(keyword);
    console.log("Battle Details after Joining:", battleAfterJoin);

    // Alice Capturing Planets
    const universeAliceContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.alice,
    );
    // Retrieve initial energy available for Alice's home planet (assuming it's planet with ID 0)
    let alicePlayerInfo = await universeAliceContract.playerAddressToPlayerInfo(this.signers.alice.address);
    let AliceHomePlanetEnergy = alicePlayerInfo.initialEnergy;

    for (let i = 1; i <= 8; i++) {
      const planet = await universeAliceContract.planets(i);
      console.log("Checking Planet", i, ":", planet);

      if (planet.owner === ethers.ZeroAddress) {
        // Calculate required energy assuming distance affects energy needed linearly
        const distance = await universeAliceContract.calculateDistance(
          alicePlayerInfo.homeCoordinateX,
          alicePlayerInfo.homeCoordinateY,
          planet.x,
          planet.y,
        );
        const requiredEnergy = planet.baseEnergy * distance;

        console.log(`Energy required to capture planet ${i}: ${requiredEnergy}`);

        if (AliceHomePlanetEnergy >= requiredEnergy) {
          console.log("Capturing Planet", i);
          const captureTx = await universeAliceContract.attackPlanet(0, i, { gasLimit: 1000000 });
          await captureTx.wait();

          // Update home planet energy after the capture attempt
          AliceHomePlanetEnergy -= requiredEnergy;

          const planetAfterCapture = await universeAliceContract.planets(i);
          console.log("Planet", i, "after capture:", planetAfterCapture);
        } else {
          console.log(
            `Not enough energy to capture planet ${i}. Required: ${requiredEnergy}, Available: ${AliceHomePlanetEnergy}`,
          );
        }
      }
    }

    // Bob Capturing planets
    const universeBobContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.bob,
    );

    // Retrieve initial energy available for Alice's home planet (assuming it's planet with ID 0)
    let bobPlayerInfo = await universeBobContract.playerAddressToPlayerInfo(this.signers.bob.address);
    let bobHomePlanetEnergy = bobPlayerInfo.initialEnergy;

    for (let i = 1; i <= 8; i++) {
      const planet = await universeBobContract.planets(i);
      console.log("Checking Planet", i, ":", planet);

      if (planet.owner === ethers.ZeroAddress) {
        // Calculate required energy assuming distance affects energy needed linearly
        const distance = await universeBobContract.calculateDistance(
          bobPlayerInfo.homeCoordinateX,
          bobPlayerInfo.homeCoordinateY,
          planet.x,
          planet.y,
        );
        const requiredEnergy = planet.baseEnergy * distance;

        console.log(`Energy required to capture planet ${i}: ${requiredEnergy}`);

        if (bobHomePlanetEnergy >= requiredEnergy) {
          console.log("Capturing Planet", i);
          const captureTx = await universeBobContract.attackPlanet(0, i, { gasLimit: 1000000 });
          await captureTx.wait();

          // Update home planet energy after the capture attempt
          bobHomePlanetEnergy -= requiredEnergy;

          const planetAfterCapture = await universeBobContract.planets(i);
          console.log("Planet", i, "after capture:", planetAfterCapture);
        } else {
          console.log(
            `Not enough energy to capture planet ${i}. Required: ${requiredEnergy}, Available: ${bobHomePlanetEnergy}`,
          );
        }
      }
    }
  });

  it("Alice should be able to capture planets", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);
    const bobPlanetBattle = await this.planetBattle.connect(this.signers.bob);
    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    await createTx.wait();

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    const joinTx = await bobPlanetBattle.joinBattle(keyword, { gasLimit: 4000000 });
    await joinTx.wait();

    await awaitAllDecryptionResults();
    await new Promise((res) => setTimeout(() => res(null), 5000));

    const battleAfterJoin = await bobPlanetBattle.battles(keyword);
    console.log("Battle Details after Joining:", battleAfterJoin);

    const universeAliceContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.alice,
    );
    // Retrieve initial energy available for Alice's home planet (assuming it's planet with ID 0)
    let playerInfo = await universeAliceContract.playerAddressToPlayerInfo(this.signers.alice.address);
    let homePlanetEnergy = playerInfo.initialEnergy;

    for (let i = 1; i <= 8; i++) {
      const planet = await universeAliceContract.planets(i);
      console.log("Checking Planet", i, ":", planet);

      if (planet.owner === ethers.ZeroAddress) {
        // Calculate required energy assuming distance affects energy needed linearly
        const distance = await universeAliceContract.calculateDistance(
          playerInfo.homeCoordinateX,
          playerInfo.homeCoordinateY,
          planet.x,
          planet.y,
        );
        const requiredEnergy = planet.baseEnergy * distance;

        console.log(`Energy required to capture planet ${i}: ${requiredEnergy}`);

        if (homePlanetEnergy >= requiredEnergy) {
          console.log("Capturing Planet", i);
          const captureTx = await universeAliceContract.attackPlanet(0, i, { gasLimit: 1000000 });
          await captureTx.wait();

          // Update home planet energy after the capture attempt
          homePlanetEnergy -= requiredEnergy;

          const planetAfterCapture = await universeAliceContract.planets(i);
          console.log("Planet", i, "after capture:", planetAfterCapture);
        } else {
          console.log(
            `Not enough energy to capture planet ${i}. Required: ${requiredEnergy}, Available: ${homePlanetEnergy}`,
          );
        }
      }
    }
  });

  it("It should be able to Decrypt Random Number battle", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);
    const bobPlanetBattle = await this.planetBattle.connect(this.signers.bob);
    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    await createTx.wait();

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    const joinTx = await bobPlanetBattle.joinBattle(keyword, { gasLimit: 4000000 });
    await joinTx.wait();

    await awaitAllDecryptionResults();
    await new Promise((res) => setTimeout(() => res(null), 5000));

    const battleAfterJoin = await bobPlanetBattle.battles(keyword);
    console.log("Battle Details after Joining:", battleAfterJoin);

    const universeAliceContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.alice,
    );

    const result = await universeAliceContract.splitRandomNumber(1000);
    console.log(result.firstFour);
    console.log(result.secondFour);
    console.log(result.thirdFour);
    console.log(result.lastFour);
  });

  it("It should be able to create battle", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);

    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    const createReceipt = await createTx.wait();
    console.log("Battle Created Transaction:", createReceipt);

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    assert.equal(battle.creator, this.signers.alice.address, "Creator should be deployer");
    assert.equal(battle.isActive, false, "Battle should not be active");
  });

  it("It should be able to create and join battle", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);
    const bobPlanetBattle = await this.planetBattle.connect(this.signers.bob);
    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    await createTx.wait();

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    const joinTx = await bobPlanetBattle.joinBattle(keyword, { gasLimit: 4000000 });
    await joinTx.wait();

    await awaitAllDecryptionResults();
    await new Promise((res) => setTimeout(() => res(null), 5000));

    const battleAfterJoin = await bobPlanetBattle.battles(keyword);
    console.log("Battle Details after Joining:", battleAfterJoin);

    const universeAliceContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.alice,
    );
    for (let i = 1; i < 9; i++) {
      console.log("The Planet information for ", i, "th planet is = ", await universeAliceContract.planets(i));
    }
    assert.equal(battleAfterJoin.creator, this.signers.alice.address, "Creator should be deployer");
    assert.equal(battleAfterJoin.joiner, this.signers.bob.address, "Joiner should be tester");
    assert.equal(battleAfterJoin.isActive, true, "Battle should be active");
  });

  it("It should be able to log planet information", async function () {
    const alicePlanetBattle = await this.planetBattle.connect(this.signers.alice);
    const bobPlanetBattle = await this.planetBattle.connect(this.signers.bob);
    const keyword = "battle1";
    const createTx = await alicePlanetBattle.createBattle(keyword, { gasLimit: 2800000 });
    await createTx.wait();

    const battle = await alicePlanetBattle.battles(keyword);
    console.log("Battle Details after Creation:", battle);

    const joinTx = await bobPlanetBattle.joinBattle(keyword, { gasLimit: 4000000 });
    await joinTx.wait();

    await awaitAllDecryptionResults();
    await new Promise((res) => setTimeout(() => res(null), 5000));

    const battleAfterJoin = await bobPlanetBattle.battles(keyword);
    console.log("Battle Details after Joining:", battleAfterJoin);

    const universeAliceContract = await ethers.getContractAt(
      "Universe",
      battleAfterJoin.universeAddress,
      this.signers.alice,
    );
    for (let i = 1; i < 9; i++) {
      console.log("The Planet information for ", i, "th planet is = ", await universeAliceContract.planets(i));
    }
  });
});
