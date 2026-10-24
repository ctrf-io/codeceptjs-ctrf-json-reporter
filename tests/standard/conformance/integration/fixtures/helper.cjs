module.exports = class Fixture extends require("codeceptjs").helper {
	check(value) {
		if (!value) throw new Error("controlled step failure");
	}
};
