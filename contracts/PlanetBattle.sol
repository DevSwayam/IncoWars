// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";
import "./Universe.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// @dev dont forgot to delete battle string after battle is reolved or terminated

contract PlanetBattle is GatewayCaller, ERC721 {
    uint256 public tokenCounter;

    struct Battle {
        address creator;
        address joiner;
        string keyword;
        bool isActive;
        address winner;
        address universeAddress;
    }

    mapping(string => Battle) public battles;
    mapping(uint256 => string) public requestIdToBattleString;
    address[] public deployedUniverses;

    event BattleCreated(string keyword, address creator);
    event BattleJoined(string keyword, address joiner);
    event UniverseDeployed(address universeAddress, string keyword);
    event BattleEnded(string keyword, address winner);
    event GeneratedCoordinates(uint256[] coordinates);

    constructor() ERC721("PlanetBattleNFT", "PBFT") {
        tokenCounter = 0;
    }

    function createBattle(string memory _keyword) public {
        require(battles[_keyword].creator == address(0), "Battle already exists with this keyword");

        Battle memory newBattle = Battle({
            creator: msg.sender,
            joiner: address(0),
            keyword: _keyword,
            isActive: false,
            winner: address(0),
            universeAddress: address(0)
        });

        battles[_keyword] = newBattle;

        emit BattleCreated(_keyword, msg.sender);
    }

    function joinBattle(string memory _keyword) public {
        Battle storage battle = battles[_keyword];
        require(battle.creator != address(0), "Battle does not exist");
        require(battle.joiner == address(0), "Battle already joined");

        battle.joiner = msg.sender;
        battle.isActive = true;

        emit BattleJoined(_keyword, msg.sender);

        euint64 _randomNumber = TFHE.randEuint64();
        euint64 _randomNumber1 = TFHE.randEuint64();
        TFHE.allow(_randomNumber, address(this));
        TFHE.allow(_randomNumber1, address(this));
        uint256[] memory cts = new uint256[](2);
        cts[0] = Gateway.toUint256(_randomNumber);
        cts[1] = Gateway.toUint256(_randomNumber1);
        uint256 requestID = Gateway.requestDecryption(
            cts,
            this.randonNumberCallBackResolver.selector,
            0,
            block.timestamp + 100,
            false
        );
        requestIdToBattleString[requestID] = _keyword;
    }

    function randonNumberCallBackResolver(
        uint256 requestID,
        uint64 decryptedInput,
        uint64 decryptedInput1
    ) public onlyGateway returns (bool) {
        string memory _battleString = requestIdToBattleString[requestID];
        deployUniverse(_battleString, decryptedInput, decryptedInput1);
        return true;
    }

    function deployUniverse(string memory _keyword, uint64 _randomNumber, uint64 _randomNumber1) internal {
        Battle storage battle = battles[_keyword];
        require(battle.isActive, "Battle is not active");

        uint256[] memory coordinates = generateRandomCoordinates(_randomNumber, _randomNumber1);
        address newUniverse = address(new Universe(battle.creator, battle.joiner, coordinates));
        deployedUniverses.push(newUniverse);
        battle.universeAddress = newUniverse;

        emit UniverseDeployed(newUniverse, _keyword);
    }

    function generateRandomCoordinates(uint64 randomNumber, uint64 randomNumber1) public returns (uint256[] memory) {
        uint256[] memory coordinates = new uint256[](16);

        uint64[2] memory randomNumbers = [randomNumber, randomNumber1];

        uint256 coordinateIndex = 0;

        for (uint256 i = 0; i < 2; i++) {
            for (uint256 j = 0; j < 16 && coordinateIndex < 16; j++) {
                // 16 4-bit chunks per uint64
                uint256 shiftAmount = j * 4; // 4 bits per coordinate
                uint32 coordinate = (uint32)((randomNumbers[i] >> shiftAmount) & 0xF); // Extract 4 bits
                coordinates[coordinateIndex] = (coordinate % 9) + 1; // Mod by 9 and add 1 to ensure range 1-9
                coordinateIndex++;
            }
        }

        // Handle the remaining coordinates using the second number (if needed)
        for (uint256 k = 0; k < 4 && coordinateIndex < 16; k++) {
            uint256 shiftAmount = (16 + k) * 4; // Remaining bits in the second uint64
            uint32 coordinate = (uint32)((randomNumbers[1] >> shiftAmount) & 0xF); // Extract remaining coordinates
            coordinates[coordinateIndex] = (coordinate % 9) + 1;
            coordinateIndex++;
        }

        emit GeneratedCoordinates(coordinates);

        return coordinates;
    }

    function endBattle(string memory _keyword, address _winner) public {
        Battle storage battle = battles[_keyword];
        require(battle.isActive, "Battle is not active");
        require(battle.universeAddress != address(0), "Universe not deployed");

        battle.isActive = false;
        battle.winner = _winner;

        emit BattleEnded(_keyword, _winner);

        mintNFT(_keyword, battle.creator, battle.joiner, _winner);
    }

    function mintNFT(string memory _keyword, address _creator, address _joiner, address _winner) internal {
        uint256 newItemId = tokenCounter;
        _safeMint(_winner, newItemId);
        tokenCounter++;

        // Optionally, you can store more metadata on-chain or off-chain
    }

    function getDeployedUniverses() public view returns (address[] memory) {
        return deployedUniverses;
    }
}
