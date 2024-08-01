// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";

contract Universe is GatewayCaller {
    struct Planet {
        int256 x; // X coordinate of the planet
        int256 y; // Y coordinate of the planet
        uint256 baseEnergy; // Base energy of the planet when captured
        uint256 attackingPower; // Attacking power of the planet
        uint256 defensePower; // Defense power of the planet
        uint256 energyGenerationRate; // Energy generation rate per second
        uint256 lastCalculatedTimestamp; // Timestamp of the last energy calculation
        address owner; // Owner of the planet
        euint16 randomNumber;
    }

    struct playerInfo {
        uint256 initialEnergy;
        int256 homeCoordinateX;
        int256 homeCoordinateY;
    }

    mapping(uint256 => uint256) public requestIdToPlanetId;

    address public player1; // Address of player 1
    address public player2; // Address of player 2
    mapping(uint256 => Planet) public planets; // Mapping of planet IDs to Planet structs
    uint256 public totalPlanets = 8; // Total number of planets in the game
    uint256 public gameStartTime; // Start time of the game
    uint256 public constant GAME_DURATION = 10 minutes; // Duration of the game
    bool public gameEnded; // Flag indicating if the game has ended
    address public winner; // Address of the winner of the game
    mapping(address => playerInfo) public playerAddressToPlayerInfo;

    event PlanetCaptured(uint256 planetId, address owner); // Event emitted when a planet is captured
    event EnergyTransferred(uint256 fromPlanetId, uint256 toPlanetId, uint256 energy); // Event emitted when energy is transferred between planets
    event BattleEnded(address winner); // Event emitted when the game ends and a winner is determined

    /**
     * @dev Constructor function to initialize the Universe contract.
     * @param _player1 Address of player 1
     * @param _player2 Address of player 2
     * @param coordinates Array of coordinates for initializing planets
     */
    constructor(address _player1, address _player2, uint256[] memory coordinates) {
        require(coordinates.length == 16, "Invalid coordinates length");

        player1 = _player1;
        player2 = _player2;
        gameStartTime = block.timestamp;
        gameEnded = false;

        playerAddressToPlayerInfo[_player1] = playerInfo({
            initialEnergy: 1000,
            homeCoordinateX: 0,
            homeCoordinateY: 5
        });

        playerAddressToPlayerInfo[_player2] = playerInfo({
            initialEnergy: 1000,
            homeCoordinateX: 10,
            homeCoordinateY: 5
        });

        for (uint256 i = 0; i < totalPlanets; i++) {
            planets[i + 1] = Planet({
                x: int256(coordinates[i * 2]),
                y: int256(coordinates[i * 2 + 1]),
                baseEnergy: 100,
                attackingPower: 1, // Will be decide on capture
                defensePower: 1, // will be decided on capture
                energyGenerationRate: 0, // will be decided on capture
                lastCalculatedTimestamp: 0,
                owner: address(0),
                randomNumber: TFHE.randEuint16() // i get 8 bits here i will use them to split in 3 parts 3bits  for attacking and 3 bits for defence power and 2 bits for energy generation rate
            });
            TFHE.allow(planets[i+1].randomNumber, address(this));
        }
    }

    /**
     * @dev Modifier to check if the game has ended based on time.
     * If the game has ended, prevent further function execution.
     */
    modifier checkGameEnd() {
        if (block.timestamp >= gameStartTime + GAME_DURATION) {
            endGame();
        }
        _;
    }

    /**
     * @dev Function to calculate the current energy of a planet based on its last calculated timestamp.
     * @param planetId ID of the planet
     * @return Current energy of the planet
     */
    function calculateEnergy(uint256 planetId) internal view returns (uint256) {
        Planet memory planet = planets[planetId];
        uint256 currentTimestamp = block.timestamp;
        if (planet.lastCalculatedTimestamp == 0) {
            return planet.baseEnergy;
        } else {
            uint256 timeElapsed = currentTimestamp - planet.lastCalculatedTimestamp;
            return planet.baseEnergy + (planet.energyGenerationRate * timeElapsed);
        }
    }

    // Ok so basically this is a home planet function used to capture planet other planet
    function capturePlanet(uint256 planetId) internal checkGameEnd {
        require(!gameEnded, "Game has ended"); // Do we need this? if we are using modifier
        require(planetId > 0 && planetId <= totalPlanets, "Invalid planet ID"); // makes sense
        require(planets[planetId].owner == address(0), "Planet already captured"); // makes sense

        playerInfo storage player = playerAddressToPlayerInfo[msg.sender]; // Ok we get player
        int256 distance = calculateDistance( // calculate the distance
            player.homeCoordinateX,
            player.homeCoordinateY,
            planets[planetId].x,
            planets[planetId].y
        );
        uint256 requiredEnergy = planets[planetId].baseEnergy * uint256(distance); // calculate required energy

        require(player.initialEnergy >= requiredEnergy, "Not enough energy to capture the planet"); // ok this makes sense

        player.initialEnergy -= requiredEnergy; // Deduct the energy used to capture the planet
        planets[planetId].owner = msg.sender; // makes sense
        planets[planetId].lastCalculatedTimestamp = block.timestamp; // makes sense


        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(planets[planetId].randomNumber);
        uint256 requestID = Gateway.requestDecryption(
            cts,
            this.randonNumberCallBackResolver.selector,
            0,
            block.timestamp + 100,
            false
        );

        requestIdToPlanetId[requestID] = planetId;
        emit PlanetCaptured(planetId, msg.sender);
    }

    function randonNumberCallBackResolver(uint256 requestID, uint16 decryptedInput) public onlyGateway returns (bool) {
        uint256 planetId = requestIdToPlanetId[requestID];
        (uint8 attackingPower, uint8 defensePower, uint8 energyGenerationRate, ) = splitRandomNumber(decryptedInput);
        planets[planetId].attackingPower = (attackingPower % 5) + 1;
        planets[planetId].defensePower = (defensePower % 5) + 1;
        planets[planetId].energyGenerationRate = (energyGenerationRate % 5) + 1;
        return true;
    }

    function splitRandomNumber(
        uint16 value
    ) public pure returns (uint8 firstFour, uint8 secondFour, uint8 thirdFour, uint8 lastFour) {
        // Extract the first 4 bits
        firstFour = uint8(value & 0x0F); // 0x0F is the hexadecimal value for 15 (binary 1111)

        // Extract the second 4 bits
        // Shift right by 4 bits then mask with 0x0F
        secondFour = uint8((value >> 4) & 0x0F);

        // Extract the third 4 bits
        // Shift right by 8 bits then mask with 0x0F
        thirdFour = uint8((value >> 8) & 0x0F);

        // Extract the last 4 bits
        // Shift right by 12 bits to get the last 4 bits
        lastFour = uint8((value >> 12) & 0x0F);
    }

    /**
     * @dev Function for a player to transfer energy from one captured planet to another.
     * @param fromPlanetId ID of the planet from which energy is transferred
     * @param toPlanetId ID of the planet to which energy is transferred
     * @param energy Energy to transfer between planets
     * @param distance Distance between the two planets
     */
    function attackPlanetToPlanet(
        uint256 fromPlanetId,
        uint256 toPlanetId,
        uint256 energy,
        uint256 distance
    ) internal checkGameEnd {
        require(!gameEnded, "Game has ended");
        require(planets[fromPlanetId].owner == msg.sender, "You do not own the from planet");
        require(planets[toPlanetId].owner != msg.sender, "You already own the to planet");

        uint256 fromPlanetEnergy = calculateEnergy(fromPlanetId);
        require(energy <= fromPlanetEnergy, "Not enough energy on from planet");

        uint256 effectiveEnergy = energy + ((energy * planets[fromPlanetId].attackingPower) / 100);
        uint256 requiredEnergy = calculateEnergy(toPlanetId) * distance * planets[toPlanetId].defensePower;

        if (planets[toPlanetId].owner == address(0)) {
            // Capturing a new planet
            require(effectiveEnergy >= requiredEnergy, "Not enough effective energy to capture the planet");
            capturingPlanetForFirstTime(toPlanetId);
        } else {
            // Capturing an enemy's planet
            require(effectiveEnergy >= requiredEnergy * 2, "Not enough effective energy to conquer the planet");
            capturingEnemiesPlanet(toPlanetId);
        }

        planets[fromPlanetId].baseEnergy -= energy;
        emit EnergyTransferred(fromPlanetId, toPlanetId, energy);
    }

    function capturingPlanetForFirstTime(uint256 planetId) internal {
        // Assume the decryption and random number splitting logic is handled here
        // @dev need async decrypt
        // planets[planetId].attackingPower = uint256(planets[planetId].randomNumber & 0x07); // last 3 bits
        // planets[planetId].defensePower = uint256((planets[planetId].randomNumber >> 3) & 0x07); // next 3 bits
        // planets[planetId].energyGenerationRate = uint256((planets[planetId].randomNumber >> 6) & 0x03); // next 2 bits

        planets[planetId].owner = msg.sender;
        planets[planetId].lastCalculatedTimestamp = block.timestamp;
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(planets[planetId].randomNumber);
        uint256 requestID = Gateway.requestDecryption(
            cts,
            this.randonNumberCallBackResolver.selector,
            0,
            block.timestamp + 100,
            false
        );
        requestIdToPlanetId[requestID] = planetId;
        emit PlanetCaptured(planetId, msg.sender);
    }

    function capturingEnemiesPlanet(uint256 planetId) internal {
        planets[planetId].owner = msg.sender;
    }

    function attackPlanet(uint256 fromPlanetId, uint256 toPlanetId) public {
        if (fromPlanetId == 0) {
            // Check if the attack is from the home planet
            capturePlanet(toPlanetId);
        } else {
            int256 distance = calculateDistance(
                planets[fromPlanetId].x,
                planets[fromPlanetId].y,
                planets[toPlanetId].x,
                planets[toPlanetId].y
            );
            uint256 energy = planets[fromPlanetId].baseEnergy; // Assuming the baseEnergy is available energy to attack
            attackPlanetToPlanet(fromPlanetId, toPlanetId, energy, uint256(distance));
        }
    }

    /**
     * @dev Function to end the game and determine the winner based on captured planets.
     */
    function endGame() public {
        require(block.timestamp >= gameStartTime + GAME_DURATION, "Game time has not ended");
        require(!gameEnded, "Game already ended");

        gameEnded = true;
        winner = determineWinner();
        emit BattleEnded(winner);
    }

    /**
     * @dev Function to determine the winner of the game based on the number of captured planets by each player.
     * @return Address of the winner
     */
    function determineWinner() internal view returns (address) {
        uint256 player1Planets = 0;
        uint256 player2Planets = 0;

        for (uint256 i = 1; i <= totalPlanets; i++) {
            if (planets[i].lastCalculatedTimestamp != 0) {
                if (planets[i].owner == player1) {
                    player1Planets++;
                } else if (planets[i].owner == player2) {
                    player2Planets++;
                }
            }
        }

        if (player1Planets > player2Planets) {
            return player1;
        } else if (player2Planets > player1Planets) {
            return player2;
        } else {
            return address(0); // No winner (tie)
        }
    }

    function calculateDistance(int256 x1, int256 y1, int256 x2, int256 y2) public pure returns (int256) {
        if (x2 > x1 && y2 > y1) {
            return sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        } else {
            return sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
        }
    }

    function sqrt(int256 x) internal pure returns (int256 y) {
        int256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
